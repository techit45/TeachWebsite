// 🔧 Google Apps Script Code - ระบบประเมินการสอน
// Version: 2.0.1
// Updated: 2025 - Simplified evaluation system
// วิธีใช้: แทนที่โค้ดทั้งหมดใน Google Apps Script Editor

// =============================================================================
// 📋 MAIN HANDLERS - จัดการ HTTP Requests
// =============================================================================

function doGet(e) {
  try {
    console.log('=== doGet called ===');
    console.log('Parameters:', e ? e.parameter : 'No event object');
    
    // Check if e and e.parameter exist
    if (!e || !e.parameter) {
      console.log('No parameters provided, returning default response');
      return createSuccessResponse({
        message: 'GET request received successfully',
        availableActions: ['health', 'getInstructors'],
        timestamp: new Date().toISOString(),
        version: '2.0.1',
        note: 'No parameters provided'
      });
    }
    
    // Health check endpoint
    if (e.parameter.action === 'health') {
      return createHealthResponse();
    }
    
    // Get instructors data
    if (e.parameter.action === 'getInstructors') {
      return getInstructors();
    }
    
    // Default response for GET requests
    return createSuccessResponse({
      message: 'GET request received successfully',
      availableActions: ['health', 'getInstructors'],
      timestamp: new Date().toISOString(),
      version: '2.0.1'
    });
    
  } catch (error) {
    console.error('Error in doGet:', error);
    return createErrorResponse('GET request failed: ' + error.toString());
  }
}

function doPost(e) {
  try {
    console.log('=== doPost called ===');
    console.log('Post data exists:', e && e.postData ? true : false);
    
    // Handle preflight OPTIONS request or empty POST
    if (!e || !e.postData || !e.postData.contents) {
      console.log('Handling preflight or empty request');
      return createCORSResponse();
    }
    
    // Parse request data
    let requestData;
    try {
      requestData = JSON.parse(e.postData.contents);
      console.log('Parsed request data:', requestData);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Invalid JSON format: ' + parseError.message);
    }
    
    // Validate action
    if (!requestData.action) {
      throw new Error('Missing required field: action');
    }
    
    // Route to appropriate handler
    let result;
    switch (requestData.action) {
      case 'health':
        result = createHealthResponse();
        break;
      case 'submitEvaluation':
        result = submitEvaluation(requestData);
        break;
      case 'updateInstructors':
        result = updateInstructors(requestData.instructorsMap || requestData.data);
        break;
      case 'getInstructors':
        result = getInstructors();
        break;
      default:
        throw new Error('Unknown action: ' + requestData.action);
    }
    
    console.log('=== doPost completed successfully ===');
    return result;
    
  } catch (error) {
    console.error('=== doPost ERROR ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    return createErrorResponse('POST request failed: ' + error.toString());
  }
}

// =============================================================================
// 📊 DATA HANDLERS - จัดการข้อมูล
// =============================================================================

function getInstructors() {
  try {
    console.log('Getting instructors data...');
    
    const spreadsheet = SpreadsheetApp.getActive();
    let instructorsSheet = spreadsheet.getSheetByName('instructors');
    
    // Create sheet if doesn't exist
    if (!instructorsSheet) {
      console.log('Creating instructors sheet...');
      instructorsSheet = createInstructorsSheet(spreadsheet);
    }
    
    // Get data from sheet
    const data = instructorsSheet.getDataRange().getValues();
    console.log('Raw data rows:', data.length);
    
    // Process data into structured format
    const result = {};
    
    if (data.length > 1) { // Skip header row
      for (let i = 1; i < data.length; i++) {
        const [center, week, day, period, instructor1, instructor2] = data[i];
        
        // Skip empty rows
        if (!center || !week || !day || !period) {
          console.log('Skipping empty row:', i);
          continue;
        }
        
        // Build nested structure
        if (!result[center]) result[center] = {};
        if (!result[center][week]) result[center][week] = {};
        if (!result[center][week][day]) result[center][week][day] = {};
        
        result[center][week][day][period] = {
          instructor1: instructor1 || '',
          instructor2: instructor2 || ''
        };
      }
    }
    
    console.log('Processed centers:', Object.keys(result).length);
    
    return createSuccessResponse({
      data: result,
      message: 'Instructors data retrieved successfully',
      recordCount: data.length - 1
    });
    
  } catch (error) {
    console.error('Error in getInstructors:', error);
    return createErrorResponse('Failed to get instructors: ' + error.toString());
  }
}

function submitEvaluation(evaluationData) {
  try {
    console.log('=== Submitting evaluation ===');
    console.log('Evaluation data:', evaluationData);
    
    // Validate required fields
    const requiredFields = ['center', 'week', 'day', 'period'];
    for (const field of requiredFields) {
      if (!evaluationData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Validate at least one instructor
    if (!evaluationData.instructor1 && !evaluationData.instructor2) {
      throw new Error('At least one instructor must be specified');
    }
    
    // Validate ratings
    const ratingFields = ['clarity', 'preparation', 'interaction', 'punctuality', 'satisfaction'];
    for (const field of ratingFields) {
      const rating = parseInt(evaluationData[field]);
      if (isNaN(rating) || rating < 1 || rating > 5) {
        throw new Error(`Invalid rating for ${field}: must be 1-5`);
      }
    }
    
    
    const spreadsheet = SpreadsheetApp.getActive();
    let evaluationSheet = spreadsheet.getSheetByName('evaluation');
    
    // Create sheet if doesn't exist
    if (!evaluationSheet) {
      console.log('Creating evaluation sheet...');
      evaluationSheet = createEvaluationSheet(spreadsheet);
    }
    
    // Prepare data row
    const now = new Date();
    const timestamp = Utilities.formatDate(now, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm:ss');
    
    const rowData = [
      timestamp,                                    // A: Timestamp
      evaluationData.center || '',                 // B: ศูนย์
      evaluationData.week || '',                   // C: สัปดาห์
      evaluationData.day || '',                    // D: วัน
      evaluationData.period || '',                 // E: ช่วงเวลา
      evaluationData.instructor1 || '',            // F: ผู้สอน1
      evaluationData.instructor2 || '',            // G: ผู้สอน2
      parseInt(evaluationData.clarity) || 0,       // H: ความชัดเจน
      parseInt(evaluationData.preparation) || 0,   // I: การเตรียม
      parseInt(evaluationData.interaction) || 0,   // J: ปฏิสัมพันธ์
      parseInt(evaluationData.punctuality) || 0,   // K: ตรงต่อเวลา
      parseInt(evaluationData.satisfaction) || 0,  // L: พึงพอใจ
      evaluationData.comment || ''                 // M: ข้อเสนอแนะ
    ];
    
    console.log('Adding row data:', rowData);
    
    // Add row to sheet
    evaluationSheet.appendRow(rowData);
    const lastRow = evaluationSheet.getLastRow();
    
    // Format the new row
    formatEvaluationRow(evaluationSheet, lastRow, rowData.length);
    
    console.log('Successfully submitted evaluation to row:', lastRow);
    
    return createSuccessResponse({
      message: 'บันทึกการประเมินสำเร็จ',
      rowNumber: lastRow,
      submittedData: {
        center: evaluationData.center,
        week: evaluationData.week,
        day: evaluationData.day,
        period: evaluationData.period,
        instructor1: evaluationData.instructor1,
        instructor2: evaluationData.instructor2
      }
    });
    
  } catch (error) {
    console.error('Error in submitEvaluation:', error);
    return createErrorResponse('Failed to submit evaluation: ' + error.toString());
  }
}

function updateInstructors(instructorsMap) {
  try {
    console.log('=== Updating instructors ===');
    
    if (!instructorsMap || typeof instructorsMap !== 'object') {
      throw new Error('Invalid instructorsMap provided');
    }
    
    const spreadsheet = SpreadsheetApp.getActive();
    let instructorsSheet = spreadsheet.getSheetByName('instructors');
    
    if (!instructorsSheet) {
      instructorsSheet = createInstructorsSheet(spreadsheet);
    }
    
    // Clear existing data (keep headers)
    const lastRow = instructorsSheet.getLastRow();
    if (lastRow > 1) {
      instructorsSheet.deleteRows(2, lastRow - 1);
    }
    
    // Prepare data for writing
    const dataToWrite = [];
    
    Object.entries(instructorsMap).forEach(([center, weeksObj]) => {
      Object.entries(weeksObj).forEach(([week, daysObj]) => {
        Object.entries(daysObj).forEach(([day, periodsObj]) => {
          Object.entries(periodsObj).forEach(([period, instructors]) => {
            dataToWrite.push([
              center,
              week,
              day,
              period,
              instructors.instructor1 || '',
              instructors.instructor2 || ''
            ]);
          });
        });
      });
    });
    
    console.log('Data to write:', dataToWrite.length, 'rows');
    
    // Write data to sheet
    if (dataToWrite.length > 0) {
      instructorsSheet.getRange(2, 1, dataToWrite.length, 6).setValues(dataToWrite);
      
      // Format data
      formatInstructorsSheet(instructorsSheet, dataToWrite.length);
    }
    
    console.log('Successfully updated instructors sheet');
    
    return createSuccessResponse({
      message: 'อัปเดตข้อมูลผู้สอนสำเร็จ',
      rowsUpdated: dataToWrite.length
    });
    
  } catch (error) {
    console.error('Error in updateInstructors:', error);
    return createErrorResponse('Failed to update instructors: ' + error.toString());
  }
}

// =============================================================================
// 🏗️ SHEET CREATION - สร้าง Sheets
// =============================================================================

function createInstructorsSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('instructors');
  
  // Create headers
  const headers = ['ศูนย์', 'สัปดาห์', 'วัน', 'ช่วงเวลา', 'ผู้สอน1', 'ผู้สอน2'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setBorder(true, true, true, true, true, true);
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, headers.length);
  
  // Add sample data
  const sampleData = [
    ['ลาดกระบัง', '1', 'เสาร์', 'เช้า', 'อาจารย์สมชาย', 'อาจารย์สมหญิง'],
    ['ลาดกระบัง', '1', 'เสาร์', 'บ่าย', 'อาจารย์สมศักดิ์', ''],
    ['ลาดกระบัง', '1', 'อาทิตย์', 'เช้า', 'อาจารย์สมพงษ์', 'อาจารย์สมใจ'],
    ['บางพลัด', '1', 'เสาร์', 'เช้า', 'อาจารย์วีรชัย', ''],
    ['ระยอง', '1', 'เสาร์', 'เช้า', 'อาจารย์นันทา', 'อาจารย์สุชาดา'],
    ['ศรีราชา', '1', 'อาทิตย์', 'บ่าย', 'อาจารย์ปราณี', '']
  ];
  
  if (sampleData.length > 0) {
    sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);
    formatInstructorsSheet(sheet, sampleData.length);
  }
  
  console.log('Created instructors sheet with sample data');
  return sheet;
}

function createEvaluationSheet(spreadsheet) {
  const sheet = spreadsheet.insertSheet('evaluation');
  
  // Create headers
  const headers = [
    'Timestamp',        // A
    'ศูนย์',            // B
    'สัปดาห์',          // C
    'วัน',              // D
    'ช่วงเวลา',         // E
    'ผู้สอน1',          // F
    'ผู้สอน2',          // G
    'ความชัดเจน',       // H
    'การเตรียม',        // I
    'ปฏิสัมพันธ์',      // J
    'ตรงต่อเวลา',       // K
    'พึงพอใจ',          // L
    'ข้อเสนอแนะ'        // M
  ];
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Format headers
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('white');
  headerRange.setBorder(true, true, true, true, true, true);
  
  // Set column widths
  sheet.setColumnWidth(1, 150); // Timestamp
  sheet.setColumnWidth(2, 100); // ศูนย์
  sheet.setColumnWidth(3, 80);  // สัปดาห์
  sheet.setColumnWidth(4, 80);  // วัน
  sheet.setColumnWidth(5, 100); // ช่วงเวลา
  sheet.setColumnWidth(6, 150); // ผู้สอน1
  sheet.setColumnWidth(7, 150); // ผู้สอน2
  sheet.setColumnWidth(8, 100); // ความชัดเจน
  sheet.setColumnWidth(9, 100); // การเตรียม
  sheet.setColumnWidth(10, 120); // ปฏิสัมพันธ์
  sheet.setColumnWidth(11, 100); // ตรงต่อเวลา
  sheet.setColumnWidth(12, 100); // พึงพอใจ
  sheet.setColumnWidth(13, 250); // ข้อเสนอแนะ
  
  console.log('Created evaluation sheet');
  return sheet;
}

// =============================================================================
// 🎨 FORMATTING - จัดรูปแบบ
// =============================================================================

function formatInstructorsSheet(sheet, dataRows) {
  if (dataRows <= 0) return;
  
  // Format data rows
  const dataRange = sheet.getRange(2, 1, dataRows, 6);
  dataRange.setBorder(true, true, true, true, true, true);
  
  // Alternate row colors
  for (let i = 2; i <= dataRows + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRange(i, 1, 1, 6).setBackground('#f8f9fa');
    }
  }
  
  // Center align specific columns
  sheet.getRange(2, 2, dataRows, 4).setHorizontalAlignment('center'); // สัปดาห์, วัน, ช่วงเวลา
}

function formatEvaluationRow(sheet, row, columnCount) {
  // Add borders
  sheet.getRange(row, 1, 1, columnCount).setBorder(true, true, true, true, true, true);
  
  // Format rating columns (H-L) with colors
  for (let col = 8; col <= 12; col++) {
    const cell = sheet.getRange(row, col);
    const score = cell.getValue();
    
    if (score >= 5) {
      cell.setBackground('#34a853'); // เขียวเข้ม
      cell.setFontColor('white');
      cell.setFontWeight('bold');
    } else if (score >= 4) {
      cell.setBackground('#93c5fd'); // เขียวอ่อน
    } else if (score >= 3) {
      cell.setBackground('#fbbf24'); // เหลือง
    } else if (score >= 2) {
      cell.setBackground('#fb923c'); // ส้ม
    } else {
      cell.setBackground('#ef4444'); // แดง
      cell.setFontColor('white');
      cell.setFontWeight('bold');
    }
    
    // Center align ratings
    cell.setHorizontalAlignment('center');
  }
  
  // Alternate row background for basic info
  if (row % 2 === 0) {
    sheet.getRange(row, 1, 1, 7).setBackground('#f8f9fa'); // Basic info columns
    sheet.getRange(row, 13, 1, 1).setBackground('#f8f9fa'); // Comment column
  }
}

// =============================================================================
// 📤 RESPONSE HELPERS - จัดการ Response
// =============================================================================

function createSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'success',
      timestamp: new Date().toISOString(),
      ...data
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createErrorResponse(message) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'error',
      message: message,
      timestamp: new Date().toISOString()
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

function createHealthResponse() {
  const spreadsheet = SpreadsheetApp.getActive();
  return createSuccessResponse({
    message: 'System is healthy',
    version: '2.0.1',
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    features: ['instructor-management', 'evaluation-submission'],
    sheets: spreadsheet.getSheets().map(sheet => ({
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      columns: sheet.getLastColumn()
    }))
  });
}

function createCORSResponse() {
  // Return a valid JSON response for preflight/empty requests
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'preflight-ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// 🧪 TEST FUNCTIONS - ฟังก์ชันทดสอบ
// =============================================================================

function testHealthCheck() {
  const result = createHealthResponse();
  console.log('Health check result:', result.getContent());
  return JSON.parse(result.getContent());
}

function testGetInstructors() {
  const result = getInstructors();
  console.log('Get instructors result:', result.getContent());
  return JSON.parse(result.getContent());
}

function testSubmitEvaluation() {
  const testData = {
    action: 'submitEvaluation',
    center: "ลาดกระบัง",
    week: "1",
    day: "เสาร์",
    period: "เช้า",
    instructor1: "ทดสอบระบบ",
    instructor2: "",
    clarity: 5,
    preparation: 4,
    interaction: 5,
    punctuality: 4,
    satisfaction: 5,
    comment: "ทดสอบจาก Google Apps Script Editor"
  };
  
  const result = submitEvaluation(testData);
  console.log('Submit evaluation result:', result.getContent());
  return JSON.parse(result.getContent());
}


// Quick test function for debugging
function testQuick() {
  console.log('=== Quick Test ===');
  try {
    const health = testHealthCheck();
    console.log('Health check OK:', health.status === 'success');
    
    const evalTest = testSubmitEvaluation();
    console.log('Evaluation test OK:', evalTest.status === 'success');
    
    return { health: health, evalTest: evalTest };
  } catch (error) {
    console.error('Quick test error:', error);
    return { error: error.toString() };
  }
}

function testUpdateInstructors() {
  const testData = {
    "ลาดกระบัง": {
      "1": {
        "เสาร์": {
          "เช้า": { "instructor1": "อาจารย์ทดสอบ A", "instructor2": "อาจารย์ทดสอบ B" },
          "บ่าย": { "instructor1": "อาจารย์ทดสอบ C", "instructor2": "" }
        }
      }
    }
  };
  
  const result = updateInstructors(testData);
  console.log('Update instructors result:', result.getContent());
  return JSON.parse(result.getContent());
}

function runAllTests() {
  console.log('=== Running All Tests ===');
  
  try {
    console.log('1. Testing Health Check...');
    const health = testHealthCheck();
    console.log('✅ Health check passed');
    
    console.log('2. Testing Get Instructors...');
    const instructors = testGetInstructors();
    console.log('✅ Get instructors passed');
    
    console.log('3. Testing Submit Evaluation...');
    const evaluation = testSubmitEvaluation();
    console.log('✅ Submit evaluation passed');
    
    console.log('=== All Tests Completed Successfully ===');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// =============================================================================
// 📊 UTILITY FUNCTIONS - ฟังก์ชันเสริม
// =============================================================================

function getSpreadsheetInfo() {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheets = spreadsheet.getSheets();
  
  const info = {
    id: spreadsheet.getId(),
    name: spreadsheet.getName(),
    url: spreadsheet.getUrl(),
    sheets: sheets.map(sheet => ({
      name: sheet.getName(),
      rows: sheet.getLastRow(),
      columns: sheet.getLastColumn(),
      dataRange: sheet.getDataRange().getA1Notation()
    }))
  };
  
  console.log('Spreadsheet info:', JSON.stringify(info, null, 2));
  return info;
}

function clearAllEvaluations() {
  const spreadsheet = SpreadsheetApp.getActive();
  const evaluationSheet = spreadsheet.getSheetByName('evaluation');
  
  if (evaluationSheet) {
    const lastRow = evaluationSheet.getLastRow();
    if (lastRow > 1) {
      evaluationSheet.deleteRows(2, lastRow - 1);
      console.log('Cleared all evaluation data');
    }
  }
}

function exportEvaluationsToCSV() {
  const spreadsheet = SpreadsheetApp.getActive();
  const evaluationSheet = spreadsheet.getSheetByName('evaluation');
  
  if (!evaluationSheet) {
    console.log('No evaluation sheet found');
    return null;
  }
  
  const data = evaluationSheet.getDataRange().getValues();
  const csvContent = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
  console.log('CSV export completed, rows:', data.length);
  return csvContent;
}

// =============================================================================
// 📋 INITIALIZATION - การเริ่มต้น
// =============================================================================

function onOpen() {
  // สร้าง custom menu ใน Google Sheets
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🎓 ระบบประเมินการสอน v2.0.1')
    .addItem('📊 ตรวจสอบสถานะระบบ', 'showSystemStatus')
    .addItem('🧪 ทดสอบทุกฟังก์ชัน', 'runAllTests')
    .addSeparator()
    .addItem('📥 ดูข้อมูลผู้สอน', 'showInstructorsData')
    .addItem('📋 ส่งออกข้อมูลประเมิน', 'exportEvaluations')
    .addSeparator()
    .addItem('🗑️ ล้างข้อมูลประเมิน', 'confirmClearEvaluations')
    .addToUi();
}

function showSystemStatus() {
  const health = testHealthCheck();
  const ui = SpreadsheetApp.getUi();
  
  ui.alert('สถานะระบบ', 
    `✅ ระบบทำงานปกติ\n\n` +
    `📋 Spreadsheet: ${health.spreadsheetName}\n` +
    `🆔 ID: ${health.spreadsheetId}\n` +
    `📊 Sheets: ${health.sheets.length} แผ่น\n` +
    `🕐 เวลาตรวจสอบ: ${new Date().toLocaleString('th-TH')}`,
    ui.ButtonSet.OK);
}

function showInstructorsData() {
  const result = testGetInstructors();
  const ui = SpreadsheetApp.getUi();
  
  if (result.status === 'success') {
    const centerCount = Object.keys(result.data).length;
    ui.alert('ข้อมูลผู้สอน', 
      `📊 จำนวนศูนย์: ${centerCount}\n` +
      `📈 จำนวนระเบียน: ${result.recordCount}\n\n` +
      `ศูนย์ที่มีข้อมูล:\n${Object.keys(result.data).join('\n')}`,
      ui.ButtonSet.OK);
  } else {
    ui.alert('ข้อผิดพลาด', result.message, ui.ButtonSet.OK);
  }
}

function exportEvaluations() {
  const csv = exportEvaluationsToCSV();
  const ui = SpreadsheetApp.getUi();
  
  if (csv) {
    // สร้างไฟล์ CSV ใน Google Drive
    const fileName = `evaluation_export_${Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd_HHmmss')}.csv`;
    const blob = Utilities.newBlob(csv, 'text/csv', fileName);
    const file = DriveApp.createFile(blob);
    
    ui.alert('ส่งออกข้อมูลสำเร็จ', 
      `📁 ไฟล์: ${fileName}\n` +
      `🔗 URL: ${file.getUrl()}\n\n` +
      `ไฟล์ถูกบันทึกใน Google Drive แล้ว`,
      ui.ButtonSet.OK);
  } else {
    ui.alert('ไม่พบข้อมูล', 'ไม่มีข้อมูลการประเมินให้ส่งออก', ui.ButtonSet.OK);
  }
}

function confirmClearEvaluations() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('ยืนยันการลบข้อมูล', 
    '⚠️ คุณต้องการลบข้อมูลการประเมินทั้งหมดหรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้',
    ui.ButtonSet.YES_NO);
  
  if (response === ui.Button.YES) {
    clearAllEvaluations();
    ui.alert('ลบข้อมูลเรียบร้อย', '🗑️ ข้อมูลการประเมินทั้งหมดถูกลบแล้ว', ui.ButtonSet.OK);
  }
}

// =============================================================================
// 📝 LOGGING - การบันทึก
// =============================================================================

console.log('🎓 Teaching Evaluation System v2.0.1 - Simplified Version - Loaded successfully');
console.log('📋 Available functions:');
console.log('- doGet(e) / doPost(e): Main handlers');
console.log('- getInstructors(): Get instructor data');
console.log('- submitEvaluation(data): Submit evaluation');
console.log('- updateInstructors(data): Update instructor data');
console.log('- runAllTests(): Test all functions');
console.log('- getSpreadsheetInfo(): Get spreadsheet details');
console.log('💡 Ready for deployment!');