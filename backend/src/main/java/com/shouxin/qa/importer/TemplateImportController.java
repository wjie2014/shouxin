package com.shouxin.qa.importer;

import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import com.shouxin.qa.audit.OperationLogService;
import org.apache.poi.ss.usermodel.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/import")
public class TemplateImportController {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    private final OperationLogService logs;
    private final DataFormatter formatter = new DataFormatter(Locale.CHINA);

    public TemplateImportController(JdbcTemplate jdbc, AuthUserService users, OperationLogService logs) {
        this.jdbc = jdbc;
        this.users = users;
        this.logs = logs;
    }

    @PostMapping(value = "/second-stage/preview", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    public Map<String, Object> secondStagePreview(@RequestPart("file") MultipartFile file) throws IOException {
        return parse(file, true).toMap();
    }

    @PostMapping(value = "/first-stage/preview", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    public Map<String, Object> firstStagePreview(@RequestPart("file") MultipartFile file) throws IOException {
        return parse(file, false).toMap();
    }

    @PostMapping(value = "/second-stage", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> secondStage(@RequestPart("file") MultipartFile file, Authentication authentication) throws IOException {
        return persist(parse(file, true).validRows(), authentication, "第二阶段多Sheet文件导入", file.getOriginalFilename());
    }

    @PostMapping(value = "/first-stage", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> firstStage(@RequestPart("file") MultipartFile file, Authentication authentication) throws IOException {
        return persist(parse(file, false).validRows(), authentication, "第一阶段文件导入", file.getOriginalFilename());
    }

    @PostMapping({"/first-stage/confirm", "/second-stage/confirm"})
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public Map<String, Object> confirm(@RequestBody ConfirmRequest request, Authentication authentication) {
        if (request == null || request.rows() == null || request.rows().isEmpty()) {
            throw new IllegalArgumentException("没有可导入的数据");
        }
        return persist(request.rows(), authentication, "预览确认导入", null);
    }

    private PreviewResult parse(MultipartFile file, boolean secondStage) throws IOException {
        validateFile(file);
        List<PreviewRow> rows = new ArrayList<>();
        List<String> sheetErrors = new ArrayList<>();
        int compatibleSheets = 0;
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            for (int sheetIndex = 0; sheetIndex < workbook.getNumberOfSheets(); sheetIndex++) {
                Sheet sheet = workbook.getSheetAt(sheetIndex);
                Header header = findHeader(sheet);
                if (header == null) {
                    if (sheet.getPhysicalNumberOfRows() > 0) sheetErrors.add(sheet.getSheetName() + "：未找到“问题/答案”表头");
                    continue;
                }
                compatibleSheets++;
                String level1Id = secondStage ? findLevel1BySheetName(sheet.getSheetName()) : "domain-01";
                for (int rowIndex = header.rowIndex() + 1; rowIndex <= sheet.getLastRowNum(); rowIndex++) {
                    Row row = sheet.getRow(rowIndex);
                    if (row == null) continue;
                    String question = text(row, header.question()), answer = text(row, header.answer());
                    if (question.isBlank() && answer.isBlank()) continue;
                    String level2Value = header.level2() < 0 ? "" : text(row, header.level2());
                    String level3Value = header.level3() < 0 ? "" : text(row, header.level3());
                    String referenceDoc = header.referenceDoc() < 0 ? "" : text(row, header.referenceDoc());
                    boolean customerSecondStageLayout = secondStage && looksLikeLevelOneValue(level2Value, sheet.getSheetName());
                    String level2Id = secondStage && !customerSecondStageLayout ? findDomain(level2Value, level1Id, 2) : secondStage ? null : "domain-l2-01";
                    String level3Id = secondStage && level2Id != null && !level3Value.isBlank() ? findDomain(level3Value, level2Id, 3) : null;
                    // 客户原始第二阶段模板把“1-热电”放在目录2，把“01-基础”放在目录3；
                    // 系统内部对应一级、二级目录。导出的系统模板则是真正的二、三级目录，两种格式都兼容。
                    if (secondStage && level2Id == null && !level3Value.isBlank()) {
                        level2Id = findDomain(level3Value, level1Id, 2);
                        level3Id = level2Id == null ? null : defaultChild(level2Id);
                    }
                    List<String> errors = new ArrayList<>();
                    if (question.isBlank()) errors.add("问题不能为空");
                    if (answer.isBlank()) errors.add("答案不能为空");
                    if (level1Id == null) errors.add("Sheet名称未匹配到一级目录");
                    if (secondStage && level2Id == null) errors.add("二级目录不存在");
                    if (secondStage && !level3Value.isBlank() && level2Id != null && level3Id == null) errors.add("三级目录不存在");
                    rows.add(new PreviewRow(question, answer, referenceDoc, level1Id, level2Id, level3Id,
                            sheet.getSheetName(), rowIndex + 1, errors.isEmpty(), String.join("；", errors)));
                }
            }
            if (compatibleSheets == 0) throw new IllegalArgumentException("未找到可导入的Sheet，请确认包含“问题”和“答案”表头");
            return new PreviewResult(rows, workbook.getNumberOfSheets(), compatibleSheets, sheetErrors);
        }
    }

    private Map<String, Object> persist(List<PreviewRow> rows, Authentication authentication, String action, String source) {
        AuthUser operator = users.findByUsername(authentication.getName());
        int imported = 0;
        List<String> errors = new ArrayList<>();
        for (PreviewRow row : rows) {
            if (!row.valid() || row.question() == null || row.question().isBlank() || row.answer() == null || row.answer().isBlank()) continue;
            try {
                String level1Id = blankDefault(row.domainL1Id(), "domain-01");
                String level2Id = blankDefault(row.domainL2Id(), "domain-l2-01");
                String pairId = UUID.randomUUID().toString(), versionId = UUID.randomUUID().toString();
                jdbc.update("INSERT INTO qa_pair(id,qa_code,current_version_id,domain_l1_id,domain_l2_id,domain_l3_id,author_id,unit_id,status) VALUES(?,?,?,?,?,?,?,(SELECT unit_id FROM sys_user WHERE id=?),'draft')",
                        pairId, nextCode(), versionId, level1Id, level2Id, blankToNull(row.domainL3Id()), operator.id(), operator.id());
                jdbc.update("INSERT INTO qa_pair_version(id,qa_pair_id,version_no,question_html,question_text,answer_html,answer_text,reference_doc,extension_data,version_status,created_by) VALUES(?,?, 'V1.0',?,?,?,?,?,?,'draft',?)",
                        versionId, pairId, row.question(), row.question(), row.answer(), row.answer(), blankToNull(row.referenceDoc()),
                        "{\"source\":\"excel-import\",\"sheet\":\"" + jsonSafe(row.sheet()) + "\"}", operator.id());
                imported++;
            } catch (Exception exception) {
                errors.add((row.sheet() == null ? "" : row.sheet() + " ") + "第" + row.row() + "行：" + exception.getMessage());
            }
        }
        logs.record(operator.id(), "IMPORT_TEMPLATE", action + "，成功" + imported + "条", "IMPORT", source);
        return Map.of("imported", imported, "failed", errors.size(), "errors", errors);
    }

    private Header findHeader(Sheet sheet) {
        int last = Math.min(sheet.getLastRowNum(), 10);
        for (int rowIndex = 0; rowIndex <= last; rowIndex++) {
            Row row = sheet.getRow(rowIndex);
            if (row == null) continue;
            int question = -1, answer = -1, level2 = -1, level3 = -1, reference = -1;
            for (int column = 0; column < row.getLastCellNum(); column++) {
                String name = text(row, column).replaceAll("\\s+", "");
                if (Set.of("问题", "问题内容").contains(name)) question = column;
                else if (Set.of("答案", "答案内容").contains(name)) answer = column;
                else if (Set.of("目录2", "二级目录").contains(name)) level2 = column;
                else if (Set.of("目录3", "三级目录").contains(name)) level3 = column;
                else if (Set.of("依据文档", "参考文档").contains(name)) reference = column;
            }
            if (question >= 0 && answer >= 0) return new Header(rowIndex, question, answer, level2, level3, reference);
        }
        return null;
    }

    private String findLevel1BySheetName(String sheetName) {
        java.util.regex.Matcher index = java.util.regex.Pattern.compile("(?:问答对)?[（(]?\\s*(\\d{1,2})\\s*[-—]").matcher(sheetName);
        if (index.find()) {
            List<String> byOrder = jdbc.queryForList("SELECT id FROM qa_domain WHERE level_no=1 AND deleted=0 AND sort_order=? FETCH FIRST 1 ROWS ONLY", String.class, Integer.parseInt(index.group(1)));
            if (!byOrder.isEmpty()) return byOrder.get(0);
        }
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM qa_domain WHERE level_no=1 AND deleted=0 AND (? LIKE '%'||domain_name||'%' OR domain_name=?) FETCH FIRST 1 ROWS ONLY",
                String.class, sheetName.trim(), sheetName.trim());
        return ids.isEmpty() ? null : ids.get(0);
    }

    private boolean looksLikeLevelOneValue(String value,String sheetName){
        if(value==null)return false;java.util.regex.Pattern pattern=java.util.regex.Pattern.compile("(\\d{1,2})\\s*[-—]");
        java.util.regex.Matcher valueMatch=pattern.matcher(value.replace("\n","")),sheetMatch=pattern.matcher(sheetName);
        return valueMatch.find()&&sheetMatch.find()&&Integer.parseInt(valueMatch.group(1))==Integer.parseInt(sheetMatch.group(1));
    }

    private String findDomain(String value, String parentId, int level) {
        if (value == null || value.isBlank() || parentId == null || parentId.isBlank()) return null;
        String normalized = value.replace("\n", "").trim();
        String withoutPrefix = normalized.replaceFirst("^\\d{1,3}\\s*[-—_]\\s*", "").trim();
        String rawCode = normalized.replaceFirst("\\s*[-—_].*$", "").trim();
        String code = rawCode.replaceFirst("^0+(?=\\d)", "");
        List<String> ids = jdbc.queryForList(
                "SELECT id FROM qa_domain WHERE parent_id=? AND level_no=? AND deleted=0 AND (id=? OR domain_name IN (?,?) OR domain_code IN (?,?,?)) ORDER BY sort_order FETCH FIRST 1 ROWS ONLY",
                String.class, parentId, level, normalized, normalized, withoutPrefix, normalized, rawCode, code);
        return ids.isEmpty() ? null : ids.get(0);
    }

    private String defaultChild(String parentId) {
        List<String> ids=jdbc.queryForList("SELECT id FROM qa_domain WHERE parent_id=? AND level_no=3 AND enabled=1 AND deleted=0 ORDER BY sort_order FETCH FIRST 1 ROWS ONLY",String.class,parentId);
        return ids.isEmpty()?null:ids.get(0);
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null ||
                !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
            throw new IllegalArgumentException("请上传有效的xlsx文件");
        }
    }

    private String text(Row row, int column) {
        if (row == null || column < 0) return "";
        Cell cell = row.getCell(column, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        return cell == null ? "" : formatter.formatCellValue(cell).trim();
    }

    private String nextCode() {
        Integer next = jdbc.queryForObject("SELECT COUNT(*) + 1 FROM qa_pair", Integer.class);
        return "QA-" + java.time.Year.now() + "-" + String.format("%04d", next == null ? 1 : next);
    }

    private String blankDefault(String value, String defaultValue) { return value == null || value.isBlank() ? defaultValue : value; }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
    private String jsonSafe(String value) { return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\""); }

    private record Header(int rowIndex, int question, int answer, int level2, int level3, int referenceDoc) {}

    private record PreviewResult(List<PreviewRow> rows, int sheetCount, int compatibleSheets, List<String> errors) {
        List<PreviewRow> validRows() { return rows.stream().filter(PreviewRow::valid).toList(); }
        Map<String, Object> toMap() {
            long valid = rows.stream().filter(PreviewRow::valid).count();
            return Map.of("total", rows.size(), "valid", valid, "invalid", rows.size() - valid,
                    "sheetCount", sheetCount, "compatibleSheets", compatibleSheets, "errors", errors, "rows", rows);
        }
    }

    public record ConfirmRequest(List<PreviewRow> rows) {}
    public record PreviewRow(String question, String answer, String referenceDoc,
                             String domainL1Id, String domainL2Id, String domainL3Id,
                             String sheet, int row, boolean valid, String error) {}
}
