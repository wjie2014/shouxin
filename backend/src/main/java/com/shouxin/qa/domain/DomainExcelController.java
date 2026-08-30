package com.shouxin.qa.domain;

import jakarta.servlet.http.HttpServletResponse;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/api/admin/domains")
@PreAuthorize("hasAuthority('config:domains')")
public class DomainExcelController {
    private final JdbcTemplate jdbc;
    public DomainExcelController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/export")
    public void export(HttpServletResponse response) throws IOException {
        response.setContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        response.setHeader("Content-Disposition", "attachment; filename=knowledge-domains.xlsx");
        try (Workbook workbook = new XSSFWorkbook()) {
            Sheet sheet = workbook.createSheet("知识目录");
            CellStyle header = style(workbook, true), body = style(workbook, false);
            String[] names = {"一级目录编码", "一级目录名称", "二级目录编码", "二级目录名称", "三级目录编码", "三级目录名称", "描述"};
            Row head = sheet.createRow(0); for (int i=0;i<names.length;i++){Cell cell=head.createCell(i);cell.setCellValue(names[i]);cell.setCellStyle(header);}
            List<Map<String,Object>> rows = jdbc.queryForList("SELECT d1.domain_code l1_code,d1.domain_name l1_name,d2.domain_code l2_code,d2.domain_name l2_name,d3.domain_code l3_code,d3.domain_name l3_name,d3.description FROM qa_domain d1 LEFT JOIN qa_domain d2 ON d2.parent_id=d1.id AND d2.deleted=0 LEFT JOIN qa_domain d3 ON d3.parent_id=d2.id AND d3.deleted=0 WHERE d1.level_no=1 AND d1.deleted=0 ORDER BY d1.sort_order,d2.sort_order,d3.sort_order");
            int index=1; for(Map<String,Object> item:rows){Row row=sheet.createRow(index++);String[] keys={"L1_CODE","L1_NAME","L2_CODE","L2_NAME","L3_CODE","L3_NAME","DESCRIPTION"};for(int i=0;i<keys.length;i++){Cell cell=row.createCell(i);Object value=item.get(keys[i]);cell.setCellValue(value==null?"":String.valueOf(value));cell.setCellStyle(body);}}
            sheet.createFreezePane(0,1); sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0,Math.max(0,sheet.getLastRowNum()),0,names.length-1));
            int[] widths={18,24,18,28,18,30,40};for(int i=0;i<widths.length;i++)sheet.setColumnWidth(i,widths[i]*256);
            workbook.write(response.getOutputStream());
        }
    }

    @PostMapping(value="/import", consumes="multipart/form-data")
    @Transactional
    public Map<String,Object> importExcel(@RequestPart("file") MultipartFile file) throws IOException {
        if(file==null||file.isEmpty()||file.getOriginalFilename()==null||!file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw new IllegalArgumentException("请上传xlsx目录文件");
        int created=0, updated=0; List<String> errors=new ArrayList<>(); DataFormatter formatter=new DataFormatter(Locale.CHINA);
        try(Workbook workbook=WorkbookFactory.create(file.getInputStream())){
            Sheet sheet=workbook.getSheetAt(0);
            for(int rowIndex=1;rowIndex<=sheet.getLastRowNum();rowIndex++){
                Row row=sheet.getRow(rowIndex); if(row==null)continue;
                String l1c=text(row,0,formatter),l1n=text(row,1,formatter),l2c=text(row,2,formatter),l2n=text(row,3,formatter),l3c=text(row,4,formatter),l3n=text(row,5,formatter),description=text(row,6,formatter);
                if(l1n.isBlank()&&l2n.isBlank()&&l3n.isBlank())continue;
                try { String l1=upsert(null,1,l1c,l1n,""); String l2=l2n.isBlank()?null:upsert(l1,2,l2c,l2n,""); if(!l3n.isBlank())upsert(l2,3,l3c,l3n,description); created++; }
                catch(RuntimeException exception){errors.add("第"+(rowIndex+1)+"行："+exception.getMessage());}
            }
        }
        return Map.of("processed",created,"updated",updated,"failed",errors.size(),"errors",errors);
    }

    private String upsert(String parent,int level,String code,String name,String description){
        if(name==null||name.isBlank())throw new IllegalArgumentException("目录名称不能为空");
        List<String> ids=parent==null?jdbc.queryForList("SELECT id FROM qa_domain WHERE parent_id IS NULL AND level_no=? AND deleted=0 AND domain_name=?",String.class,level,name):jdbc.queryForList("SELECT id FROM qa_domain WHERE parent_id=? AND level_no=? AND deleted=0 AND domain_name=?",String.class,parent,level,name);
        if(!ids.isEmpty()){if(description!=null&&!description.isBlank())jdbc.update("UPDATE qa_domain SET description=?,enabled=1,updated_at=CURRENT_TIMESTAMP WHERE id=?",description,ids.get(0));return ids.get(0);}
        String id=UUID.randomUUID().toString(), safeCode=code==null||code.isBlank()?"D"+System.nanoTime():code;
        Integer next=parent==null?jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),0)+1 FROM qa_domain WHERE parent_id IS NULL",Integer.class):jdbc.queryForObject("SELECT COALESCE(MAX(sort_order),0)+1 FROM qa_domain WHERE parent_id=?",Integer.class,parent);
        jdbc.update("INSERT INTO qa_domain(id,parent_id,domain_code,domain_name,level_no,path,sort_order,description) VALUES(?,?,?,?,?,?,?,?)",id,parent,safeCode,name,level,name,next==null?1:next,description);return id;
    }
    private String text(Row row,int column,DataFormatter formatter){Cell cell=row.getCell(column,Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);return cell==null?"":formatter.formatCellValue(cell).trim();}
    private CellStyle style(Workbook workbook,boolean header){CellStyle style=workbook.createCellStyle();style.setWrapText(true);style.setBorderTop(BorderStyle.THIN);style.setBorderRight(BorderStyle.THIN);style.setBorderBottom(BorderStyle.THIN);style.setBorderLeft(BorderStyle.THIN);if(header){style.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());style.setFillPattern(FillPatternType.SOLID_FOREGROUND);Font font=workbook.createFont();font.setBold(true);font.setColor(IndexedColors.WHITE.getIndex());style.setFont(font);}return style;}
}
