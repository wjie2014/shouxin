package com.shouxin.qa.statistics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.nio.file.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
public class AnalysisReportService {
    private final JdbcTemplate jdbc; private final ObjectMapper mapper; private final AnalysisExportService export; private final AuthUserService users; private final Path root;
    public AnalysisReportService(JdbcTemplate jdbc,ObjectMapper mapper,AnalysisExportService export,AuthUserService users,@Value("${app.storage.path}")String storage){this.jdbc=jdbc;this.mapper=mapper;this.export=export;this.users=users;this.root=Paths.get(storage).toAbsolutePath().normalize().resolve("analysis-reports");}

    public String generate(String schemeId,String userId,String subscriptionId){String reportId=UUID.randomUUID().toString();Map<String,Object> scheme=jdbc.queryForMap("SELECT scheme_name,config_json,built_in FROM qa_analysis_scheme WHERE id=?",schemeId);String reportName=String.valueOf(value(scheme,"scheme_name"))+"-"+export.fileName();jdbc.update("INSERT INTO qa_analysis_report(id,subscription_id,scheme_id,user_id,report_name,report_status) VALUES(?,?,?,?,?,'GENERATING')",reportId,subscriptionId,schemeId,userId,reportName);try{AuthUser user=users.findById(userId);AnalysisService.AnalysisRequest request=mapper.readValue(String.valueOf(value(scheme,"config_json")),AnalysisService.AnalysisRequest.class);if(number(scheme,"built_in")==1)request=rollingThirtyDays(request);byte[] content=export.export(request,user);Files.createDirectories(root);Path file=root.resolve(reportId+".xlsx").normalize();if(!file.startsWith(root))throw new IllegalStateException("报告路径无效");Files.write(file,content,StandardOpenOption.CREATE_NEW);jdbc.update("UPDATE qa_analysis_report SET report_status='READY',file_path=? WHERE id=?",file.toString(),reportId);}catch(Exception e){jdbc.update("UPDATE qa_analysis_report SET report_status='FAILED',error_message=? WHERE id=?",safeError(e),reportId);}return reportId;}

    private AnalysisService.AnalysisRequest rollingThirtyDays(AnalysisService.AnalysisRequest request){LocalDate today=LocalDate.now();AnalysisService.DateRange range=new AnalysisService.DateRange(today.minusDays(29).toString(),today.toString(),request.dateRange()==null?"createdAt":request.dateRange().timeField());return new AnalysisService.AnalysisRequest(request.mode(),request.primaryDimension(),request.secondaryDimension(),request.metrics(),range,request.filters(),request.granularity(),request.sortBy(),request.sortDir(),request.limit(),request.comparePreviousPeriod(),request.slaHours(),request.page(),request.pageSize(),request.drillLabel(),request.drillSecondary());}

    @Scheduled(initialDelay=60000,fixedDelay=60000)
    public void runDueSubscriptions(){List<Map<String,Object>> due=jdbc.queryForList("SELECT id,scheme_id,user_id,frequency,run_hour FROM qa_analysis_subscription WHERE enabled=1 AND next_run_at<=CURRENT_TIMESTAMP ORDER BY next_run_at LIMIT 20");for(Map<String,Object> item:due){String id=String.valueOf(value(item,"id"));try{Timestamp next=next(String.valueOf(value(item,"frequency")),number(item,"run_hour"));jdbc.update("UPDATE qa_analysis_subscription SET last_run_at=CURRENT_TIMESTAMP,next_run_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",next,id);generate(String.valueOf(value(item,"scheme_id")),String.valueOf(value(item,"user_id")),id);}catch(Exception ignored){}}}

    public Timestamp next(String frequency,int hour){LocalDateTime now=LocalDateTime.now();LocalDateTime candidate=now.toLocalDate().atTime(Math.max(0,Math.min(23,hour)),0);candidate=switch(frequency.toUpperCase(Locale.ROOT)){case"WEEKLY"->candidate.with(java.time.DayOfWeek.MONDAY);case"MONTHLY"->candidate.withDayOfMonth(1);default->candidate;};if(!candidate.isAfter(now))candidate=switch(frequency.toUpperCase(Locale.ROOT)){case"WEEKLY"->candidate.plusWeeks(1);case"MONTHLY"->candidate.plusMonths(1);default->candidate.plusDays(1);};return Timestamp.valueOf(candidate);}
    public Path reportPath(String id,String userId,boolean admin){Map<String,Object> row=jdbc.queryForList("SELECT file_path,user_id,report_status FROM qa_analysis_report WHERE id=?",id).stream().findFirst().orElseThrow(()->new NoSuchElementException("报告不存在"));if(!admin&&!userId.equals(String.valueOf(value(row,"user_id"))))throw new org.springframework.security.access.AccessDeniedException("无权下载该报告");if(!"READY".equals(String.valueOf(value(row,"report_status"))))throw new IllegalArgumentException("报告尚未生成完成");Path path=Paths.get(String.valueOf(value(row,"file_path"))).toAbsolutePath().normalize();if(!path.startsWith(root)||!Files.exists(path))throw new NoSuchElementException("报告文件不存在");jdbc.update("UPDATE qa_analysis_report SET read_flag=1 WHERE id=?",id);return path;}
    private Object value(Map<String,Object> row,String key){return row.containsKey(key)?row.get(key):row.get(key.toUpperCase(Locale.ROOT));}
    private int number(Map<String,Object> row,String key){Object value=value(row,key);return value instanceof Number n?n.intValue():0;}
    private String safeError(Exception e){String value=e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();return value.length()>900?value.substring(0,900):value;}
}
