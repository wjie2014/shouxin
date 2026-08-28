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
    private final JdbcTemplate jdbc; private final AuthUserService users; private final OperationLogService logs;
    public TemplateImportController(JdbcTemplate jdbc, AuthUserService users, OperationLogService logs){this.jdbc=jdbc;this.users=users;this.logs=logs;}

    /** Imports the second-stage workbook. Each sheet represents one level-1 domain. */
    @PostMapping(value="/second-stage", consumes="multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')") @Transactional
    public Map<String,Object> secondStage(@RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
        if(file.isEmpty() || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw new IllegalArgumentException("请上传xlsx文件");
        AuthUser operator=users.findByUsername(auth.getName()); int imported=0, skipped=0; List<String> errors=new ArrayList<>();
        try(Workbook wb=WorkbookFactory.create(file.getInputStream())) {
            for(int si=0;si<wb.getNumberOfSheets();si++) { Sheet sheet=wb.getSheetAt(si); String l1="domain-"+String.format("%02d",si+1);
                if(jdbc.queryForObject("SELECT COUNT(*) FROM qa_domain WHERE id=? AND level_no=1 AND deleted=0",Integer.class,l1)!=1){errors.add(sheet.getSheetName()+":一级目录不存在");continue;}
                for(int rn=3;rn<=sheet.getLastRowNum();rn++){ Row row=sheet.getRow(rn); if(row==null)continue; String q=text(row,3), a=text(row,4); if(q.isBlank()||a.isBlank()||"。。。".equals(q)){skipped++;continue;}
                    try {String d2=text(row,1), d3=text(row,2); String l2=lookupDomain(d2,l1,2), l3=lookupDomain(d3,l2,3); if(l2==null){errors.add(sheet.getSheetName()+"第"+(rn+1)+"行：二级目录不存在");continue;}
                        String pair=UUID.randomUUID().toString(), ver=UUID.randomUUID().toString(); String code=nextCode();
                        jdbc.update("INSERT INTO qa_pair(id,qa_code,current_version_id,domain_l1_id,domain_l2_id,domain_l3_id,author_id,unit_id,status) VALUES(?,?,?,?,?,?,?,(SELECT unit_id FROM sys_user WHERE id=?),'draft')",pair,code,ver,l1,l2,l3,operator.id(),operator.id());
                        jdbc.update("INSERT INTO qa_pair_version(id,qa_pair_id,version_no,question_html,question_text,answer_html,answer_text,reference_doc,extension_data,version_status,created_by) VALUES(?,?, 'V1.0',?,?,?,?,?,?,'draft',?)",ver,pair,q,q,a,a,text(row,5),"{\"source\":\"second-stage\",\"sheet\":\""+sheet.getSheetName()+"\"}",operator.id()); imported++;
                    } catch(Exception ex){errors.add(sheet.getSheetName()+"第"+(rn+1)+"行："+ex.getMessage());}
                }
            }
        }
        logs.record(operator.id(),"IMPORT_TEMPLATE","导入第二阶段语料模板，成功"+imported+"条","IMPORT",file.getOriginalFilename());
        return Map.of("imported",imported,"skipped",skipped,"errors",errors);
    }
    @PostMapping(value="/first-stage", consumes="multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')") @Transactional
    public Map<String,Object> firstStage(@RequestPart("file") MultipartFile file, Authentication auth) throws IOException {
        if(file.isEmpty() || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw new IllegalArgumentException("请上传xlsx文件");
        AuthUser op=users.findByUsername(auth.getName());int imported=0,skipped=0;List<String> errors=new ArrayList<>();
        try(Workbook wb=WorkbookFactory.create(file.getInputStream())){Sheet s=wb.getSheet("填写模板");if(s==null)throw new IllegalArgumentException("缺少填写模板工作表");for(int rn=3;rn<=s.getLastRowNum();rn++){Row row=s.getRow(rn);if(row==null)continue;String q=text(row,3),a=text(row,4);if(q.isBlank()||a.isBlank()){skipped++;continue;}try{String pair=UUID.randomUUID().toString(),ver=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_pair(id,qa_code,current_version_id,domain_l1_id,domain_l2_id,author_id,unit_id,status) VALUES(?,?,?,'domain-01','domain-l2-01',?,(SELECT unit_id FROM sys_user WHERE id=?),'draft')",pair,nextCode(),ver,op.id(),op.id());jdbc.update("INSERT INTO qa_pair_version(id,qa_pair_id,version_no,question_html,question_text,answer_html,answer_text,extension_data,version_status,created_by) VALUES(?,?, 'V1.0',?,?,?,?,?,'draft',?)",ver,pair,q,q,a,a,"{\"unit\":\""+text(row,0)+"\",\"scenario\":\""+text(row,1)+"\",\"tag\":\""+text(row,5)+"\",\"scope\":\""+text(row,6)+"\",\"remark\":\""+text(row,7)+"\"}",op.id());imported++;}catch(Exception ex){errors.add("第"+(rn+1)+"行："+ex.getMessage());}}}
        logs.record(op.id(),"IMPORT_TEMPLATE","导入第一阶段数据，成功"+imported+"条","IMPORT",file.getOriginalFilename());return Map.of("imported",imported,"skipped",skipped,"errors",errors);
    }

    @PostMapping(value="/first-stage/preview", consumes="multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    public Map<String,Object> firstStagePreview(@RequestPart("file") MultipartFile file) throws IOException {
        if(file.isEmpty() || file.getOriginalFilename()==null || !file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw new IllegalArgumentException("请上传xlsx文件");
        List<Map<String,Object>> rows=new ArrayList<>();
        try(Workbook wb=WorkbookFactory.create(file.getInputStream())){Sheet s=wb.getSheet("填写模板");if(s==null)throw new IllegalArgumentException("缺少填写模板工作表");for(int rn=3;rn<=s.getLastRowNum();rn++){Row row=s.getRow(rn);if(row==null)continue;String q=text(row,3),a=text(row,4);if(q.isBlank()&&a.isBlank())continue;rows.add(Map.of("row",rn+1,"unit",text(row,0),"question",q,"answer",a,"valid",!q.isBlank()&&!a.isBlank(),"error",q.isBlank()?"问题不能为空":a.isBlank()?"答案不能为空":""));}}
        return Map.of("total",rows.size(),"valid",rows.stream().filter(x->Boolean.TRUE.equals(x.get("valid"))).count(),"invalid",rows.stream().filter(x->Boolean.FALSE.equals(x.get("valid"))).count(),"rows",rows);
    }

    @PostMapping(value="/second-stage/preview", consumes="multipart/form-data")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    public Map<String,Object> secondStagePreview(@RequestPart("file") MultipartFile file) throws IOException {
        if(file.isEmpty()||file.getOriginalFilename()==null||!file.getOriginalFilename().toLowerCase(Locale.ROOT).endsWith(".xlsx")) throw new IllegalArgumentException("请上传xlsx文件");
        List<Map<String,Object>> rows=new ArrayList<>();
        try(Workbook wb=WorkbookFactory.create(file.getInputStream())){for(int si=0;si<wb.getNumberOfSheets();si++){Sheet s=wb.getSheetAt(si);for(int rn=3;rn<=s.getLastRowNum();rn++){Row row=s.getRow(rn);if(row==null)continue;String q=text(row,3),a=text(row,4),l1="domain-"+String.format("%02d",si+1),l2=text(row,1),l3=text(row,2);if(q.isBlank()&&a.isBlank())continue;Map<String,Object> item=new LinkedHashMap<>();item.put("row",rn+1);item.put("sheet",s.getSheetName());item.put("question",q);item.put("answer",a);item.put("domainL1Id",l1);item.put("domainL2Id",l2);item.put("domainL3Id",l3);item.put("valid",!q.isBlank()&&!a.isBlank());item.put("error",q.isBlank()?"问题不能为空":a.isBlank()?"答案不能为空":"");rows.add(item);}}}
        long valid=rows.stream().filter(x->Boolean.TRUE.equals(x.get("valid"))).count();return Map.of("total",rows.size(),"valid",valid,"invalid",rows.size()-valid,"rows",rows);
    }

    @PostMapping({"/first-stage/confirm","/second-stage/confirm"})
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')") @Transactional
    public Map<String,Object> firstStageConfirm(@RequestBody ConfirmRequest request, Authentication auth) {
        if(request==null||request.rows()==null||request.rows().isEmpty())throw new IllegalArgumentException("没有可导入的数据"); AuthUser op=users.findByUsername(auth.getName());int imported=0;List<String> errors=new ArrayList<>();
        for(PreviewRow row:request.rows()){if(row.question()==null||row.question().isBlank()||row.answer()==null||row.answer().isBlank())continue;try{String l1=row.domainL1Id()==null||row.domainL1Id().isBlank()?"domain-01":row.domainL1Id();String l2=row.domainL2Id();if(l2!=null&&!l2.isBlank()&&!l2.startsWith("domain-"))l2=lookupDomain(l2,l1,2);if(l2==null||l2.isBlank())l2="domain-l2-01";String l3=row.domainL3Id();if(l3!=null&&!l3.isBlank()&&!l3.startsWith("domain-"))l3=lookupDomain(l3,l2,3);String pair=UUID.randomUUID().toString(),ver=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_pair(id,qa_code,current_version_id,domain_l1_id,domain_l2_id,domain_l3_id,author_id,unit_id,status) VALUES(?,?,?,?,?,?,?,(SELECT unit_id FROM sys_user WHERE id=?),'draft')",pair,nextCode(),ver,l1,l2,l3,op.id(),op.id());jdbc.update("INSERT INTO qa_pair_version(id,qa_pair_id,version_no,question_html,question_text,answer_html,answer_text,extension_data,version_status,created_by) VALUES(?,?, 'V1.0',?,?,?,?,?,'draft',?)",ver,pair,row.question(),row.question(),row.answer(),row.answer(),"{\"source\":\"preview-confirm\"}",op.id());imported++;}catch(Exception e){errors.add(e.getMessage());}}
        logs.record(op.id(),"IMPORT_CONFIRM","确认导入第二阶段预览数据，成功"+imported+"条","IMPORT",null);return Map.of("imported",imported,"errors",errors);
    }
    private String lookupDomain(String value,String parent,int level){if(value==null||value.isBlank()||parent==null)return null;String v=value.replace("\n","").trim();List<String> ids=jdbc.queryForList("SELECT id FROM qa_domain WHERE parent_id=? AND level_no=? AND deleted=0 AND (domain_name LIKE ? OR domain_code LIKE ?) FETCH FIRST 1 ROWS ONLY",String.class,parent,level,"%"+v+"%","%"+v+"%");return ids.isEmpty()?null:ids.get(0);}
    private String nextCode(){Integer n=jdbc.queryForObject("SELECT COUNT(*) FROM qa_pair",Integer.class);return "QA-"+java.time.Year.now()+"-"+String.format("%04d",(n==null?0:n)+1);}
    private String text(Row r,int i){Cell c=r.getCell(i);if(c==null)return "";c.setCellType(CellType.STRING);return c.getStringCellValue()==null?"":c.getStringCellValue().trim();}
    public record ConfirmRequest(List<PreviewRow> rows){}
    public record PreviewRow(String question,String answer,String domainL1Id,String domainL2Id,String domainL3Id){}
}
