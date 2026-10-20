/**
 * DataParser - 엑셀(.xlsx, .xls) 및 CSV 파싱 & 데이터 정규화 모듈
 */

const DataParser = {
  // 컬럼 별칭 매핑 규칙
  ALIASES: {
    id: ['연번', 'no', '순번', '번호', 'id', '순서'],
    field: ['분야', '분야 (중점영역)', '중점영역', '부문', '영역', '카테고리', '분류'],
    name: ['세부 사업 / 주요 지표', '세부 사업', '사업명', '세부사업', '주요 지표', '과제명', '사업', '내역사업명'],
    unit: ['구분/단위', '구분', '단위', '단위(억원)'],
    budget2026: ['2026년 (A)', '2026년', '2026 (A)', '2026', '전년도 예산', '전년도', '전년', '(A)'],
    budget2027: ['2027년 정부안 (B)', '2027년', '2027 (B)', '2027', '정부안 (B)', '정부안', '금년도', '당해년도', '(B)'],
    diff: ['증감 (B-A)', '증감', '증감액', '(B-A)', '차액'],
    rate: ['증가율 (%)', '증가율', '증감률 (%)', '증감률', '증감율', '비율', '증가율(%)'],
    description: ['핵심 내용 및 보도자료 박스 원문 근거', '핵심 내용', '보도자료 원문', '원문 근거', '비고', '내용', '설명', '주요내용']
  },

  /**
   * 파일(File 객체)을 읽어 정규화된 데이터 배열 반환
   * @param {File} file 
   * @returns {Promise<{data: Array, fileName: string, totalRows: number, newCount: number}>}
   */
  async parseFile(file) {
    const isCsv = file.name.endsWith('.csv');
    const buffer = await file.arrayBuffer();

    let workbook;
    if (isCsv) {
      // CSV 디코딩: UTF-8 시도 후 실패 시 한글(EUC-KR/CP949) 감지
      let text;
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        text = utf8Decoder.decode(buffer);
      } catch (e) {
        const eucKrDecoder = new TextDecoder('euc-kr');
        text = eucKrDecoder.decode(buffer);
      }
      workbook = XLSX.read(text, { type: 'string' });
    } else {
      workbook = XLSX.read(buffer, { type: 'array' });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // 시트 데이터를 2차원 배열로 추출
    const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    if (!rawMatrix || rawMatrix.length === 0) {
      throw new Error('파일에 읽을 수 있는 데이터가 없습니다.');
    }

    return this.processMatrix(rawMatrix, file.name);
  },

  /**
   * 2차원 데이터 배열(헤더 포함)을 정규화된 객체 목록으로 가공
   */
  processMatrix(matrix, fileName = '데이터') {
    // 1. 헤더 행 탐색 (상위 5행 중 식별 가능한 헤더 검색)
    let headerRowIndex = -1;
    let columnMap = {};

    for (let r = 0; r < Math.min(matrix.length, 6); r++) {
      const row = matrix[r].map(c => String(c || '').trim());
      const detected = this.detectColumns(row);
      
      // 핵심 필드(field 또는 name 중 최소 1개, 예산 필드 최소 1개)가 매칭되면 헤더로 인정
      if ((detected.field !== undefined || detected.name !== undefined) && 
          (detected.budget2026 !== undefined || detected.budget2027 !== undefined || detected.diff !== undefined)) {
        headerRowIndex = r;
        columnMap = detected;
        break;
      }
    }

    // 헤더를 못 찾았을 경우 기본 순서로 매핑
    if (headerRowIndex === -1) {
      headerRowIndex = 0;
      columnMap = {
        id: 0,
        field: 1,
        name: 2,
        unit: 3,
        budget2026: 4,
        budget2027: 5,
        diff: 6,
        rate: 7,
        description: 8
      };
    }

    const rows = [];
    let autoId = 1;

    for (let r = headerRowIndex + 1; r < matrix.length; r++) {
      const rawRow = matrix[r];
      if (!rawRow || rawRow.every(c => c === '' || c === null || c === undefined)) {
        continue; // 빈 행 스킵
      }

      const getVal = (colIdx) => {
        if (colIdx === undefined || colIdx === -1 || colIdx >= rawRow.length) return '';
        const v = rawRow[colIdx];
        return v === null || v === undefined ? '' : String(v).trim();
      };

      const field = getVal(columnMap.field) || '기타 / 공통';
      const name = getVal(columnMap.name);
      
      // 사업명이 아예 없으면 데이터 행이 아닐 확률이 높으므로 스킵
      if (!name) continue;

      const unit = getVal(columnMap.unit) || '억원';
      
      // 숫자 파싱
      const parseNum = (valStr) => {
        if (!valStr) return 0;
        const cleaned = String(valStr).replace(/,/g, '').replace(/[^\d.-]/g, '');
        const n = parseFloat(cleaned);
        return isNaN(n) ? 0 : n;
      };

      const budget2026 = parseNum(getVal(columnMap.budget2026));
      const budget2027 = parseNum(getVal(columnMap.budget2027));
      
      let diff = 0;
      if (columnMap.diff !== undefined) {
        diff = parseNum(getVal(columnMap.diff));
      } else {
        diff = budget2027 - budget2026;
      }

      // 증가율 파싱
      const rawRate = getVal(columnMap.rate);
      let isNew = false;
      let rateFormatted = '';
      let rateValue = null;

      const desc = getVal(columnMap.description);

      // 신규사업 판단
      if (
        rawRate.includes('신규') || 
        budget2026 === 0 || 
        desc.includes('[신규') || 
        desc.includes('신규') ||
        name.includes('[신규')
      ) {
        isNew = true;
        rateFormatted = '신규';
      } else {
        // 숫자 비율 계산
        let rNum = parseFloat(rawRate.replace(/,/g, '').replace(/%/g, ''));
        if (!isNaN(rNum)) {
          // 0.349 형태로 들어왔다면 100을 곱함
          if (rNum <= 2.0 && rawRate.indexOf('%') === -1 && budget2026 > 0) {
            rNum = rNum * 100;
          }
          rateValue = rNum;
          rateFormatted = rNum.toFixed(1) + '%';
        } else if (budget2026 > 0) {
          const calcRate = ((budget2027 - budget2026) / budget2026) * 100;
          rateValue = calcRate;
          rateFormatted = calcRate.toFixed(1) + '%';
        } else {
          rateFormatted = '-';
        }
      }

      let rowId = parseInt(getVal(columnMap.id), 10);
      if (isNaN(rowId) || rowId <= 0) {
        rowId = autoId;
      }
      autoId++;

      rows.push({
        id: rowId,
        field: field,
        name: name,
        unit: unit,
        budget2026: budget2026,
        budget2027: budget2027,
        diff: diff,
        rate: rateFormatted,
        rateValue: rateValue,
        isNew: isNew,
        description: desc
      });
    }

    const newCount = rows.filter(r => r.isNew).length;

    return {
      fileName: fileName,
      totalRows: rows.length,
      newCount: newCount,
      data: rows
    };
  },

  /**
   * 행 내의 문자열들을 기반으로 컬럼 인덱스 자동 매칭
   */
  detectColumns(headerRow) {
    const map = {};
    
    headerRow.forEach((colName, index) => {
      const cleanName = colName.toLowerCase().replace(/\s+/g, '');
      
      for (const [key, aliases] of Object.entries(this.ALIASES)) {
        if (map[key] !== undefined) continue; // 이미 매핑됨
        
        for (const alias of aliases) {
          const cleanAlias = alias.toLowerCase().replace(/\s+/g, '');
          if (cleanName === cleanAlias || cleanName.includes(cleanAlias)) {
            map[key] = index;
            break;
          }
        }
      }
    });

    return map;
  }
};

window.DataParser = DataParser;
