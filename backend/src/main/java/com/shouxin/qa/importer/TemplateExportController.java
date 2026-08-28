package com.shouxin.qa.importer;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.*;

@RestController @RequestMapping("/api/export")
public class TemplateExportController {
  private final JdbcTemplate jdbc; public TemplateExportController(JdbcTemplate jdbc){this.jdbc=jdbc;}
  @GetMapping("/second-stage") @PreAuthorize("isAuthenticated()")
  public void secondStage(HttpServletResponse response) throws IOException {
    response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition","attachment; filename=qa-export.xlsx");
    try(Workbook wb=new XSSFWorkbook()){
      List<Map<String,Object>> domains=jdbc.queryForList("SELECT id,domain_name FROM qa_domain WHERE level_no=1 AND deleted=0 ORDER BY sort_order");
      for(Map<String,Object> d:domains){String name=String.valueOf(d.get("DOMAIN_NAME"));Sheet s=wb.createSheet(name.length()>25?name.substring(0,25):name);Row h=s.createRow(0);String[] headers={"序号","目录2","目录3","问题","答案","依据文档","编写人","日期","审核结果","审核意见","修改建议"};for(int i=0;i<headers.length;i++)h.createCell(i).setCellValue(headers[i]);
        List<Map<String,Object>> rows=jdbc.queryForList("SELECT p.qa_code,v.question_text,v.answer_text,v.reference_doc,u.real_name,v.created_at FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id JOIN sys_user u ON u.id=p.author_id WHERE p.domain_l1_id=? AND p.deleted=0 ORDER BY p.created_at",d.get("ID"));int n=1;for(Map<String,Object> x:rows){Row r=s.createRow(n);r.createCell(0).setCellValue(n++);r.createCell(3).setCellValue(String.valueOf(x.get("QUESTION_TEXT")));r.createCell(4).setCellValue(String.valueOf(x.get("ANSWER_TEXT")));r.createCell(5).setCellValue(String.valueOf(x.get("REFERENCE_DOC")));r.createCell(6).setCellValue(String.valueOf(x.get("REAL_NAME")));r.createCell(7).setCellValue(String.valueOf(x.get("CREATED_AT")));}
      } wb.write(response.getOutputStream());
    }
  }
  @GetMapping("/first-stage") @PreAuthorize("isAuthenticated()")
  public void firstStage(HttpServletResponse response) throws IOException {
    response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    response.setHeader("Content-Disposition","attachment; filename=qa-first-stage-export.xlsx");
    try(Workbook wb=new XSSFWorkbook()) { Sheet s=wb.createSheet("填写模板"); String[] h={"单位","场景","序号","问题","答案","标签","场景范围","备注","编写人","日期","审核结果","审核意见","修改建议"}; Row hr=s.createRow(0); for(int i=0;i<h.length;i++)hr.createCell(i).setCellValue(h[i]);
      List<Map<String,Object>> rows=jdbc.queryForList("SELECT v.question_text,v.answer_text,v.extension_data,u.real_name,v.created_at FROM qa_pair p JOIN qa_pair_version v ON v.id=p.current_version_id JOIN sys_user u ON u.id=p.author_id WHERE p.deleted=0 ORDER BY p.created_at"); int n=1; for(Map<String,Object>x:rows){Row r=s.createRow(n);r.createCell(2).setCellValue(n++);r.createCell(3).setCellValue(String.valueOf(x.get("QUESTION_TEXT")));r.createCell(4).setCellValue(String.valueOf(x.get("ANSWER_TEXT")));r.createCell(8).setCellValue(String.valueOf(x.get("REAL_NAME")));r.createCell(9).setCellValue(String.valueOf(x.get("CREATED_AT")));} wb.write(response.getOutputStream()); }
  }
}
