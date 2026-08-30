package com.shouxin.qa.importer;

import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.Set;

@RestController
@RequestMapping("/api/export")
public class TemplateExportController {
    private static final String EXCEL_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private final JdbcTemplate jdbc;
    private final AuthUserService users;

    public TemplateExportController(JdbcTemplate jdbc, AuthUserService users) { this.jdbc = jdbc; this.users = users; }

    @GetMapping("/second-stage")
    @PreAuthorize("isAuthenticated()")
    public void secondStage(HttpServletResponse response, Authentication authentication,
                            @RequestParam(required = false) String status, @RequestParam(required = false) String keyword,
                            @RequestParam(required = false) String domainL1Id, @RequestParam(required = false) String domainL2Id,
                            @RequestParam(required = false) String domainL3Id, @RequestParam(required = false) String submitFrom,
                            @RequestParam(required = false) String submitTo, @RequestParam(required = false) List<String> ids) throws IOException {
        prepareResponse(response, "qa-export.xlsx");
        AuthUser user = users.findByUsername(authentication.getName());
        boolean privileged = user.roles().stream().anyMatch(role -> Set.of("QA_REVIEW_L1", "QA_REVIEW_L2", "QA_REVIEW_L3", "QA_ADMIN", "SYS_ADMIN").contains(role));
        try (Workbook workbook = new XSSFWorkbook()) {
            CellStyle headerStyle = headerStyle(workbook), bodyStyle = bodyStyle(workbook);
            String[] headers = {"序号", "目录2", "目录3", "问题", "答案", "依据文档", "编写人", "日期", "审核结果", "审核意见", "修改建议"};
            List<Map<String, Object>> domains = jdbc.queryForList("SELECT id,domain_name FROM qa_domain WHERE level_no=1 AND deleted=0 ORDER BY sort_order");
            for (Map<String, Object> domain : domains) {
                Sheet sheet = workbook.createSheet(safeSheetName(text(domain.get("DOMAIN_NAME"))));
                createHeader(sheet, headers, headerStyle);
                StringBuilder sql = new StringBuilder(
                        "SELECT v.question_text,v.answer_text,v.reference_doc,u.real_name,v.created_at," +
                                "d2.domain_name domain_l2_name,d3.domain_name domain_l3_name,p.status " +
                                "FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id " +
                                "JOIN sys_user u ON u.id=p.author_id JOIN qa_domain d2 ON d2.id=p.domain_l2_id " +
                                "LEFT JOIN qa_domain d3 ON d3.id=p.domain_l3_id " +
                                "WHERE p.domain_l1_id=? AND p.deleted=0");
                List<Object> args = new ArrayList<>(); args.add(domain.get("ID"));
                if (!privileged) { sql.append(" AND p.author_id=?"); args.add(user.id()); }
                if (status != null && !status.isBlank()) { sql.append(" AND p.status=?"); args.add(status); }
                if (keyword != null && !keyword.isBlank()) { String like = "%" + keyword.trim() + "%"; sql.append(" AND (p.qa_code LIKE ? OR v.question_text LIKE ? OR v.answer_text LIKE ?)"); args.add(like); args.add(like); args.add(like); }
                if (domainL1Id != null && !domainL1Id.isBlank()) { sql.append(" AND p.domain_l1_id=?"); args.add(domainL1Id); }
                if (domainL2Id != null && !domainL2Id.isBlank()) { sql.append(" AND p.domain_l2_id=?"); args.add(domainL2Id); }
                if (domainL3Id != null && !domainL3Id.isBlank()) { sql.append(" AND p.domain_l3_id=?"); args.add(domainL3Id); }
                if (submitFrom != null && !submitFrom.isBlank()) { sql.append(" AND v.submitted_at>=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(submitFrom + " 00:00:00"); }
                if (submitTo != null && !submitTo.isBlank()) { sql.append(" AND v.submitted_at<=TO_TIMESTAMP(?,'YYYY-MM-DD HH24:MI:SS')"); args.add(submitTo + " 23:59:59"); }
                if (ids != null && !ids.isEmpty()) { sql.append(" AND p.id IN (").append(String.join(",", java.util.Collections.nCopies(ids.size(), "?"))).append(')'); args.addAll(ids); }
                sql.append(" ORDER BY p.created_at");
                List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
                int rowIndex = 1;
                for (Map<String, Object> item : rows) {
                    Object[] values = {rowIndex, item.get("DOMAIN_L2_NAME"), item.get("DOMAIN_L3_NAME"),
                            item.get("QUESTION_TEXT"), item.get("ANSWER_TEXT"), item.get("REFERENCE_DOC"),
                            item.get("REAL_NAME"), item.get("CREATED_AT"), statusText(item.get("STATUS")), "", ""};
                    createBodyRow(sheet, rowIndex++, values, bodyStyle);
                }
                finishSheet(sheet, headers.length, new int[]{8, 20, 22, 40, 55, 24, 16, 20, 16, 28, 28});
            }
            workbook.write(response.getOutputStream());
        }
    }

    @GetMapping("/first-stage")
    @PreAuthorize("isAuthenticated()")
    public void firstStage(HttpServletResponse response, Authentication authentication) throws IOException {
        prepareResponse(response, "qa-first-stage-export.xlsx");
        AuthUser user = users.findByUsername(authentication.getName());
        boolean privileged = user.roles().stream().anyMatch(role -> Set.of("QA_REVIEW_L1", "QA_REVIEW_L2", "QA_REVIEW_L3", "QA_ADMIN", "SYS_ADMIN").contains(role));
        try (Workbook workbook = new XSSFWorkbook()) {
            CellStyle headerStyle = headerStyle(workbook), bodyStyle = bodyStyle(workbook);
            Sheet sheet = workbook.createSheet("填写模板");
            String[] headers = {"单位", "场景", "序号", "问题", "答案", "标签", "场景范围", "备注", "编写人", "日期", "审核结果", "审核意见", "修改建议"};
            createHeader(sheet, headers, headerStyle);
            String sql = "SELECT v.question_text,v.answer_text,v.extension_data,u.real_name,v.created_at,p.status " +
                            "FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id " +
                            "JOIN sys_user u ON u.id=p.author_id WHERE p.deleted=0" + (privileged ? "" : " AND p.author_id=?") + " ORDER BY p.created_at";
            List<Map<String, Object>> rows = privileged ? jdbc.queryForList(sql) : jdbc.queryForList(sql, user.id());
            int rowIndex = 1;
            for (Map<String, Object> item : rows) {
                Object[] values = {"", "", rowIndex, item.get("QUESTION_TEXT"), item.get("ANSWER_TEXT"), "", "", "",
                        item.get("REAL_NAME"), item.get("CREATED_AT"), statusText(item.get("STATUS")), "", ""};
                createBodyRow(sheet, rowIndex++, values, bodyStyle);
            }
            finishSheet(sheet, headers.length, new int[]{16, 18, 8, 40, 55, 18, 20, 24, 16, 20, 16, 28, 28});
            workbook.write(response.getOutputStream());
        }
    }

    private void prepareResponse(HttpServletResponse response, String filename) {
        response.setContentType(EXCEL_TYPE);
        response.setHeader("Content-Disposition", "attachment; filename=" + filename);
    }

    private CellStyle headerStyle(Workbook workbook) {
        CellStyle style = borderedStyle(workbook);
        style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        style.setAlignment(HorizontalAlignment.CENTER);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        Font font = workbook.createFont();
        font.setBold(true);
        font.setColor(IndexedColors.WHITE.getIndex());
        style.setFont(font);
        return style;
    }

    private CellStyle bodyStyle(Workbook workbook) {
        CellStyle style = borderedStyle(workbook);
        style.setVerticalAlignment(VerticalAlignment.TOP);
        return style;
    }

    private CellStyle borderedStyle(Workbook workbook) {
        CellStyle style = workbook.createCellStyle();
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setBorderLeft(BorderStyle.THIN);
        style.setBorderRight(BorderStyle.THIN);
        style.setTopBorderColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setBottomBorderColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setLeftBorderColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setRightBorderColor(IndexedColors.GREY_50_PERCENT.getIndex());
        style.setWrapText(true);
        return style;
    }

    private void createHeader(Sheet sheet, String[] headers, CellStyle style) {
        Row row = sheet.createRow(0);
        row.setHeightInPoints(26);
        for (int column = 0; column < headers.length; column++) {
            Cell cell = row.createCell(column);
            cell.setCellValue(headers[column]);
            cell.setCellStyle(style);
        }
    }

    private void createBodyRow(Sheet sheet, int rowIndex, Object[] values, CellStyle style) {
        Row row = sheet.createRow(rowIndex);
        row.setHeightInPoints(34);
        for (int column = 0; column < values.length; column++) {
            Cell cell = row.createCell(column);
            Object value = values[column];
            if (value instanceof Number number) cell.setCellValue(number.doubleValue());
            else cell.setCellValue(text(value));
            cell.setCellStyle(style);
        }
    }

    private void finishSheet(Sheet sheet, int columnCount, int[] widths) {
        sheet.createFreezePane(0, 1);
        sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, Math.max(0, sheet.getLastRowNum()), 0, columnCount - 1));
        for (int column = 0; column < columnCount; column++) {
            int width = column < widths.length ? widths[column] : 18;
            sheet.setColumnWidth(column, Math.min(width, 80) * 256);
        }
    }

    private String safeSheetName(String value) {
        String name = value.isBlank() ? "未分类" : value.replaceAll("[\\\\/?*\\[\\]:]", "_");
        return name.length() > 25 ? name.substring(0, 25) : name;
    }

    private String text(Object value) { return value == null ? "" : String.valueOf(value); }

    private String statusText(Object status) {
        return switch (text(status)) {
            case "draft" -> "草稿";
            case "pending_review_l1" -> "一级审核中";
            case "pending_review_l2" -> "二级审核中";
            case "pending_review_l3" -> "三级审核中";
            case "rejected_l1", "rejected_l2", "rejected_l3" -> "已驳回";
            case "published" -> "已发布";
            case "updating" -> "更新中";
            case "retired" -> "已退役";
            default -> "";
        };
    }
}
