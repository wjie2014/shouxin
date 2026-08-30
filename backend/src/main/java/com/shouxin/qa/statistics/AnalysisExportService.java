package com.shouxin.qa.statistics;

import com.shouxin.qa.auth.AuthUser;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class AnalysisExportService {
    private final AnalysisService analysis;

    public AnalysisExportService(AnalysisService analysis) { this.analysis = analysis; }

    public byte[] export(AnalysisService.AnalysisRequest request, AuthUser user) {
        Map<String,Object> result=analysis.analyze(request,user);
        List<Map<String,Object>> details=analysis.allDetails(request,user);
        try(Workbook workbook=new XSSFWorkbook();ByteArrayOutputStream output=new ByteArrayOutputStream()){
            Styles styles=new Styles(workbook);
            writeConditions(workbook,styles,request,user);
            writeMap(workbook.createSheet("核心指标"),styles,castMap(result.get("summary")));
            writeRows(workbook.createSheet("图表数据"),styles,castList(result.get("items")));
            writeRows(workbook.createSheet("问答对明细"),styles,details);
            for(int i=0;i<workbook.getNumberOfSheets();i++){Sheet sheet=workbook.getSheetAt(i);sheet.createFreezePane(0,1);if(sheet.getLastRowNum()>=0&&sheet.getRow(0)!=null)sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0,Math.max(0,sheet.getLastRowNum()),0,Math.max(0,sheet.getRow(0).getLastCellNum()-1)));}
            workbook.write(output);return output.toByteArray();
        }catch(Exception e){throw new IllegalStateException("生成分析报告失败",e);}
    }

    public String fileName(){return "自定义分析报告-"+LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))+".xlsx";}

    private void writeConditions(Workbook workbook,Styles styles,AnalysisService.AnalysisRequest request,AuthUser user){Sheet sheet=workbook.createSheet("查询条件");String[][] values={{"项目","内容"},{"报告生成用户",user.realName()+"（"+user.username()+"）"},{"分析模式",safe(request.mode())},{"主维度",safe(request.primaryDimension())},{"次维度",safe(request.secondaryDimension())},{"开始日期",request.dateRange()==null?"":safe(request.dateRange().from())},{"结束日期",request.dateRange()==null?"":safe(request.dateRange().to())},{"时间口径",request.dateRange()==null?"":safe(request.dateRange().timeField())},{"统计粒度",safe(request.granularity())},{"生成时间",LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))}};for(int i=0;i<values.length;i++){Row row=sheet.createRow(i);for(int j=0;j<2;j++){Cell cell=row.createCell(j);cell.setCellValue(values[i][j]);cell.setCellStyle(i==0?styles.header:styles.body);}}sheet.setColumnWidth(0,22*256);sheet.setColumnWidth(1,58*256);}
    private void writeMap(Sheet sheet,Styles styles,Map<String,Object> values){Row header=sheet.createRow(0);String[] columns={"指标","数值"};for(int i=0;i<columns.length;i++){Cell cell=header.createCell(i);cell.setCellValue(columns[i]);cell.setCellStyle(styles.header);}int rowIndex=1;for(var entry:values.entrySet()){Row row=sheet.createRow(rowIndex++);Cell key=row.createCell(0);key.setCellValue(label(entry.getKey()));key.setCellStyle(styles.body);Cell value=row.createCell(1);setValue(value,entry.getValue(),styles); }sheet.setColumnWidth(0,28*256);sheet.setColumnWidth(1,22*256);}
    private void writeRows(Sheet sheet,Styles styles,List<Map<String,Object>> rows){LinkedHashSet<String> keys=new LinkedHashSet<>();rows.forEach(row->keys.addAll(row.keySet()));if(keys.isEmpty())keys.add("暂无数据");List<String> columns=new ArrayList<>(keys);Row header=sheet.createRow(0);for(int i=0;i<columns.size();i++){Cell cell=header.createCell(i);cell.setCellValue(label(columns.get(i)));cell.setCellStyle(styles.header);sheet.setColumnWidth(i,Math.min(45,Math.max(14,label(columns.get(i)).length()+5))*256);}for(int r=0;r<rows.size();r++){Row row=sheet.createRow(r+1);for(int c=0;c<columns.size();c++){Cell cell=row.createCell(c);setValue(cell,get(rows.get(r),columns.get(c)),styles);}}}
    private void setValue(Cell cell,Object value,Styles styles){if(value instanceof Number number){cell.setCellValue(number.doubleValue());cell.setCellStyle(styles.number);}else{cell.setCellValue(value==null?"":String.valueOf(value));cell.setCellStyle(styles.body);}}
    private Object get(Map<String,Object> row,String key){return row.containsKey(key)?row.get(key):row.get(key.toUpperCase(Locale.ROOT));}
    private String label(String key){return Map.ofEntries(Map.entry("total","总量"),Map.entry("published","已发布"),Map.entry("pending","审核中"),Map.entry("rejected","已驳回"),Map.entry("draft","草稿"),Map.entry("retired","已退役"),Map.entry("publishRate","发布率(%)"),Map.entry("passRate","通过率(%)"),Map.entry("rejectRate","驳回率(%)"),Map.entry("avgReviewHours","平均审核时长(小时)"),Map.entry("label","维度"),Map.entry("secondary_label","次维度"),Map.entry("count","数量"),Map.entry("qa_code","问答编号"),Map.entry("status","状态"),Map.entry("question_text","问题"),Map.entry("author_name","提交人"),Map.entry("domain_l1_name","一级目录"),Map.entry("domain_l2_name","二级目录"),Map.entry("domain_l3_name","三级目录"),Map.entry("created_at","创建时间"),Map.entry("updated_at","更新时间")).getOrDefault(key,key);}
    private String safe(String value){return value==null?"":value;}
    @SuppressWarnings("unchecked") private Map<String,Object> castMap(Object value){return (Map<String,Object>)value;}
    @SuppressWarnings("unchecked") private List<Map<String,Object>> castList(Object value){return (List<Map<String,Object>>)value;}

    private static final class Styles{
        final CellStyle header,body,number;
        Styles(Workbook workbook){header=workbook.createCellStyle();header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());header.setFillPattern(FillPatternType.SOLID_FOREGROUND);header.setAlignment(HorizontalAlignment.CENTER);header.setVerticalAlignment(VerticalAlignment.CENTER);Font font=workbook.createFont();font.setBold(true);font.setColor(IndexedColors.WHITE.getIndex());header.setFont(font);body=workbook.createCellStyle();body.setVerticalAlignment(VerticalAlignment.TOP);body.setWrapText(true);number=workbook.createCellStyle();number.setDataFormat(workbook.createDataFormat().getFormat("0.00"));for(CellStyle style:List.of(header,body,number)){style.setBorderTop(BorderStyle.THIN);style.setBorderBottom(BorderStyle.THIN);style.setBorderLeft(BorderStyle.THIN);style.setBorderRight(BorderStyle.THIN);style.setTopBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());style.setBottomBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());style.setLeftBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());style.setRightBorderColor(IndexedColors.GREY_40_PERCENT.getIndex());}}
    }
}
