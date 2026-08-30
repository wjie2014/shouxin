package com.shouxin.qa.statistics;

import com.shouxin.qa.auth.AuthUser;
import com.shouxin.qa.auth.AuthUserService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/analysis")
@PreAuthorize("isAuthenticated()")
public class AnalysisController {
    private final AnalysisService analysis;
    private final AnalysisExportService export;
    private final AuthUserService users;
    private final JdbcTemplate jdbc;

    public AnalysisController(AnalysisService analysis, AnalysisExportService export, AuthUserService users, JdbcTemplate jdbc) {
        this.analysis=analysis;this.export=export;this.users=users;this.jdbc=jdbc;
    }

    @GetMapping("/options") public Map<String,Object> options(){return analysis.options();}
    @PostMapping("/query") public Map<String,Object> query(@RequestBody AnalysisService.AnalysisRequest request,Authentication auth){return analysis.analyze(request,user(auth));}
    @PostMapping("/details") public Map<String,Object> details(@RequestBody AnalysisService.AnalysisRequest request,Authentication auth){return analysis.details(request,user(auth));}
    @PostMapping("/export") public ResponseEntity<byte[]> export(@RequestBody AnalysisService.AnalysisRequest request,Authentication auth){byte[] content=export.export(request,user(auth));String name=export.fileName();return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename*=UTF-8''"+java.net.URLEncoder.encode(name,StandardCharsets.UTF_8).replace("+","%20")).contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).contentLength(content.length).body(content);}

    @PostMapping("/events") @Transactional
    public Map<String,Object> event(@RequestBody EventRequest request,Authentication auth){String type=request.eventType()==null?"":request.eventType().toUpperCase(Locale.ROOT);if(!Set.of("SEARCH","HIT","VIEW","DOWNLOAD").contains(type))throw new IllegalArgumentException("行为类型无效");if(request.qaPairId()!=null&&!request.qaPairId().isBlank()&&jdbc.queryForObject("SELECT COUNT(*) FROM qa_pair WHERE id=? AND deleted=0",Integer.class,request.qaPairId())!=1)throw new IllegalArgumentException("问答对不存在");String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_knowledge_event(id,event_type,qa_pair_id,keyword,user_id,metadata_json) VALUES(?,?,?,?,?,?)",id,type,blankToNull(request.qaPairId()),blankToNull(request.keyword()),user(auth).id(),request.metadataJson());return Map.of("id",id);}
    @PostMapping("/feedback") @Transactional
    public Map<String,Object> feedback(@RequestBody FeedbackRequest request,Authentication auth){if(request.qaPairId()==null||request.qaPairId().isBlank())throw new IllegalArgumentException("问答对不能为空");if(request.rating()!=null&&(request.rating()<1||request.rating()>5))throw new IllegalArgumentException("评分必须为1到5分");if(request.helpful()!=null&&!Set.of(0,1).contains(request.helpful()))throw new IllegalArgumentException("有用标识无效");String id=UUID.randomUUID().toString();jdbc.update("INSERT INTO qa_feedback(id,qa_pair_id,user_id,rating,helpful,comment_text) VALUES(?,?,?,?,?,?)",id,request.qaPairId(),user(auth).id(),request.rating(),request.helpful(),request.comment());return Map.of("id",id);}

    private AuthUser user(Authentication auth){return users.findByUsername(auth.getName());}
    private String blankToNull(String value){return value==null||value.isBlank()?null:value;}
    public record EventRequest(String eventType,String qaPairId,String keyword,String metadataJson){}
    public record FeedbackRequest(String qaPairId,Integer rating,Integer helpful,String comment){}
}
