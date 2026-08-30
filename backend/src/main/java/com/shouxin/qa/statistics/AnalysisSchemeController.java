package com.shouxin.qa.statistics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import jakarta.validation.constraints.NotBlank;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.util.*;

@RestController
@RequestMapping("/api/analysis")
@PreAuthorize("isAuthenticated()")
public class AnalysisSchemeController {
    private final JdbcTemplate jdbc;private final AuthUserService users;private final ObjectMapper mapper;private final AnalysisReportService reports;
    public AnalysisSchemeController(JdbcTemplate jdbc,AuthUserService users,ObjectMapper mapper,AnalysisReportService reports){this.jdbc=jdbc;this.users=users;this.mapper=mapper;this.reports=reports;}

    @GetMapping("/schemes") public List<Map<String,Object>> schemes(Authentication auth){AuthUser user=user(auth);return jdbc.queryForList("SELECT s.id,s.scheme_name,s.description,s.visibility,s.built_in,s.owner_id,u.real_name owner_name,CAST(s.config_json AS VARCHAR(8000)) config_json,s.created_at,s.updated_at FROM qa_analysis_scheme s JOIN sys_user u ON u.id=s.owner_id WHERE s.visibility='PUBLIC' OR s.owner_id=? ORDER BY s.built_in DESC,s.updated_at DESC",user.id());}
    @PostMapping("/schemes") @Transactional public Map<String,Object> create(@RequestBody SchemeRequest request,Authentication auth)throws Exception{validateScheme(request);AuthUser user=user(auth);String visibility=visibility(request.visibility(),user);String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_analysis_scheme(id,scheme_name,description,owner_id,visibility,config_json,built_in) VALUES(?,?,?,?,?,?,0)",id,request.name().trim(),request.description(),user.id(),visibility,config(request.config()));return jdbc.queryForMap("SELECT id,scheme_name,description,visibility,built_in,owner_id,config_json FROM qa_analysis_scheme WHERE id=?",id);}
    @PutMapping("/schemes/{id}") @Transactional public void update(@PathVariable String id,@RequestBody SchemeRequest request,Authentication auth)throws Exception{validateScheme(request);AuthUser user=user(auth);requireOwner(id,user);if(jdbc.update("UPDATE qa_analysis_scheme SET scheme_name=?,description=?,visibility=?,config_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND built_in=0",request.name().trim(),request.description(),visibility(request.visibility(),user),config(request.config()),id)!=1)throw new IllegalArgumentException("内置模板不可修改");}
    @DeleteMapping("/schemes/{id}") @Transactional public void delete(@PathVariable String id,Authentication auth){AuthUser user=user(auth);requireOwner(id,user);if(jdbc.queryForObject("SELECT built_in FROM qa_analysis_scheme WHERE id=?",Integer.class,id)==1)throw new IllegalArgumentException("内置模板不可删除");jdbc.update("DELETE FROM qa_analysis_subscription WHERE scheme_id=?",id);jdbc.update("DELETE FROM qa_analysis_scheme WHERE id=?",id);}

    @GetMapping("/subscriptions") public List<Map<String,Object>> subscriptions(Authentication auth){return jdbc.queryForList("SELECT s.id,s.scheme_id,a.scheme_name,s.frequency,s.run_hour,s.enabled,s.last_run_at,s.next_run_at,s.created_at FROM qa_analysis_subscription s JOIN qa_analysis_scheme a ON a.id=s.scheme_id WHERE s.user_id=? ORDER BY s.created_at DESC",user(auth).id());}
    @PostMapping("/subscriptions") @Transactional public Map<String,Object> subscribe(@RequestBody SubscriptionRequest request,Authentication auth){AuthUser user=user(auth);requireVisible(request.schemeId(),user);String frequency=frequency(request.frequency());String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_analysis_subscription(id,scheme_id,user_id,frequency,run_hour,next_run_at) VALUES(?,?,?,?,?,?)",id,request.schemeId(),user.id(),frequency,hour(request.runHour()),reports.next(frequency,hour(request.runHour())));return jdbc.queryForMap("SELECT id,scheme_id,frequency,run_hour,enabled,next_run_at FROM qa_analysis_subscription WHERE id=?",id);}
    @PutMapping("/subscriptions/{id}") @Transactional public void updateSubscription(@PathVariable String id,@RequestBody SubscriptionRequest request,Authentication auth){AuthUser user=user(auth);requireVisible(request.schemeId(),user);String frequency=frequency(request.frequency());if(jdbc.update("UPDATE qa_analysis_subscription SET scheme_id=?,frequency=?,run_hour=?,enabled=?,next_run_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?",request.schemeId(),frequency,hour(request.runHour()),request.enabled()?1:0,reports.next(frequency,hour(request.runHour())),id,user.id())!=1)throw new NoSuchElementException("订阅不存在");}
    @DeleteMapping("/subscriptions/{id}") public void deleteSubscription(@PathVariable String id,Authentication auth){if(jdbc.update("DELETE FROM qa_analysis_subscription WHERE id=? AND user_id=?",id,user(auth).id())!=1)throw new NoSuchElementException("订阅不存在");}
    @PostMapping("/schemes/{id}/generate") public Map<String,Object> generate(@PathVariable String id,Authentication auth){AuthUser user=user(auth);requireVisible(id,user);return Map.of("reportId",reports.generate(id,user.id(),null));}
    @GetMapping("/reports") public List<Map<String,Object>> reportList(Authentication auth){return jdbc.queryForList("SELECT r.id,r.report_name,r.report_status,r.error_message,r.read_flag,r.generated_at,s.scheme_name FROM qa_analysis_report r JOIN qa_analysis_scheme s ON s.id=r.scheme_id WHERE r.user_id=? ORDER BY r.generated_at DESC",user(auth).id());}
    @GetMapping("/reports/{id}/download") public ResponseEntity<FileSystemResource> download(@PathVariable String id,Authentication auth){AuthUser user=user(auth);boolean admin=isAdmin(user);Path path=reports.reportPath(id,user.id(),admin);return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=analysis-report.xlsx").contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).body(new FileSystemResource(path));}

    private String config(Object config)throws Exception{if(config==null)throw new IllegalArgumentException("分析配置不能为空");String json=config instanceof String s?s:mapper.writeValueAsString(config);mapper.readValue(json,AnalysisService.AnalysisRequest.class);return json;}
    private void validateScheme(SchemeRequest request){if(request==null||request.name()==null||request.name().isBlank())throw new IllegalArgumentException("方案名称不能为空");}
    private void requireOwner(String id,AuthUser user){Map<String,Object> row=jdbc.queryForList("SELECT owner_id FROM qa_analysis_scheme WHERE id=?",id).stream().findFirst().orElseThrow(()->new NoSuchElementException("方案不存在"));if(!isAdmin(user)&&!user.id().equals(String.valueOf(value(row,"owner_id"))))throw new org.springframework.security.access.AccessDeniedException("仅方案所有者可以修改");}
    private void requireVisible(String id,AuthUser user){Integer count=jdbc.queryForObject("SELECT COUNT(*) FROM qa_analysis_scheme WHERE id=? AND (visibility='PUBLIC' OR owner_id=?)",Integer.class,id,user.id());if(count==null||count==0)throw new NoSuchElementException("分析方案不存在或无权访问");}
    private String visibility(String value,AuthUser user){String normalized="PUBLIC".equalsIgnoreCase(value)?"PUBLIC":"PRIVATE";if("PUBLIC".equals(normalized)&&!isAdmin(user))return "PRIVATE";return normalized;}
    private String frequency(String value){String normalized=value==null?"WEEKLY":value.toUpperCase(Locale.ROOT);if(!Set.of("DAILY","WEEKLY","MONTHLY").contains(normalized))throw new IllegalArgumentException("订阅频率无效");return normalized;}
    private int hour(Integer value){return Math.max(0,Math.min(23,value==null?8:value));}
    private AuthUser user(Authentication auth){return users.findByUsername(auth.getName());}
    private boolean isAdmin(AuthUser user){return user.roles().stream().anyMatch(role->Set.of("SYS_ADMIN","QA_ADMIN").contains(role));}
    private Object value(Map<String,Object> row,String key){return row.containsKey(key)?row.get(key):row.get(key.toUpperCase(Locale.ROOT));}
    public record SchemeRequest(@NotBlank String name,String description,String visibility,Object config){}
    public record SubscriptionRequest(String schemeId,String frequency,Integer runHour,boolean enabled){}
}
