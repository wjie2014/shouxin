package com.shouxin.qa.qapair;

import com.shouxin.qa.auth.AuthUserService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.*;
import java.util.*;

@RestController
@RequestMapping("/api/qa-pairs/{pairId}/attachments")
public class AttachmentController {
    private final JdbcTemplate jdbc;
    private final AuthUserService users;
    private final PairAccess access;
    private final Path root;

    public AttachmentController(JdbcTemplate jdbc, AuthUserService users, PairAccess access, @Value("${app.storage.path}") String path) {
        this.jdbc = jdbc; this.users = users; this.access = access; this.root = Paths.get(path).toAbsolutePath().normalize();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    public Map<String,Object> upload(@PathVariable String pairId,@RequestPart("file") MultipartFile file,Authentication authentication)throws IOException {
        access.require(pairId,authentication,true);
        if(file.isEmpty()||file.getSize()>50L*1024*1024)throw new IllegalArgumentException("文件为空或超过50MB");
        String original=Path.of(Objects.requireNonNullElse(file.getOriginalFilename(),"file")).getFileName().toString();
        if(original.isBlank())throw new IllegalArgumentException("文件名不能为空");
        String version=jdbc.queryForObject("SELECT current_version_id FROM qa_pair WHERE id=? AND deleted=0",String.class,pairId);
        Files.createDirectories(root);String key=UUID.randomUUID()+"-"+original;Path target=root.resolve(key).normalize();
        if(!target.startsWith(root))throw new IllegalArgumentException("非法文件名");
        try(InputStream input=file.getInputStream()){Files.copy(input,target,StandardCopyOption.REPLACE_EXISTING);}
        String checksum=sha256(target),id=UUID.randomUUID().toString();
        jdbc.update("INSERT INTO qa_attachment(id,version_id,original_name,object_key,content_type,size_bytes,checksum,created_by) VALUES(?,?,?,?,?,?,?,?)",id,version,original,key,file.getContentType(),file.getSize(),checksum,users.findByUsername(authentication.getName()).id());
        return Map.of("id",id,"name",original,"size",file.getSize(),"checksum",checksum);
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public List<Map<String,Object>> list(@PathVariable String pairId,Authentication authentication){
        access.require(pairId,authentication,false);
        return jdbc.queryForList("SELECT a.id,a.original_name,a.content_type,a.size_bytes,a.checksum,a.created_at,v.version_no,CASE WHEN v.id=p.current_version_id THEN 1 ELSE 0 END current_version FROM qa_attachment a JOIN qa_pair_version v ON v.id=a.version_id JOIN qa_pair p ON p.id=v.qa_pair_id WHERE v.qa_pair_id=? ORDER BY a.created_at DESC",pairId);
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FileSystemResource> download(@PathVariable String pairId,@PathVariable String id,Authentication authentication){return file(pairId,id,authentication,false);}

    @GetMapping("/{id}/preview")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<FileSystemResource> preview(@PathVariable String pairId,@PathVariable String id,Authentication authentication){return file(pairId,id,authentication,true);}

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('QA_SUBMITTER','QA_ADMIN','SYS_ADMIN')")
    @Transactional
    public void delete(@PathVariable String pairId,@PathVariable String id,Authentication authentication)throws IOException{
        access.require(pairId,authentication,true);
        Map<String,Object> row=metadata(pairId,id);
        if(jdbc.update("DELETE FROM qa_attachment WHERE id=? AND version_id=(SELECT current_version_id FROM qa_pair WHERE id=?)",id,pairId)!=1)throw new IllegalArgumentException("只能删除当前编辑版本的附件");
        Path target=safePath(String.valueOf(value(row,"object_key")));Files.deleteIfExists(target);
    }

    private ResponseEntity<FileSystemResource> file(String pairId,String id,Authentication authentication,boolean inline){
        access.require(pairId,authentication,false);Map<String,Object> row=metadata(pairId,id);Path target=safePath(String.valueOf(value(row,"object_key")));
        if(!Files.exists(target))throw new NoSuchElementException("附件文件不存在");
        String original=String.valueOf(value(row,"original_name"));String type=String.valueOf(Objects.requireNonNullElse(value(row,"content_type"),"application/octet-stream"));
        String disposition=(inline?"inline":"attachment")+"; filename*=UTF-8''"+URLEncoder.encode(original, StandardCharsets.UTF_8).replace("+","%20");
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,disposition).contentType(MediaType.parseMediaType(type)).contentLength(target.toFile().length()).body(new FileSystemResource(target));
    }

    private Map<String,Object> metadata(String pairId,String id){return jdbc.queryForList("SELECT a.object_key,a.original_name,a.content_type FROM qa_attachment a JOIN qa_pair_version v ON v.id=a.version_id WHERE a.id=? AND v.qa_pair_id=?",id,pairId).stream().findFirst().orElseThrow(()->new NoSuchElementException("附件不存在"));}
    private Path safePath(String key){Path target=root.resolve(key).normalize();if(!target.startsWith(root))throw new IllegalArgumentException("非法附件路径");return target;}
    private Object value(Map<String,Object> row,String key){return row.getOrDefault(key,row.get(key.toUpperCase(Locale.ROOT)));}
    private String sha256(Path path)throws IOException{try{MessageDigest md=MessageDigest.getInstance("SHA-256");try(InputStream in=Files.newInputStream(path)){byte[] buffer=new byte[8192];for(int n;(n=in.read(buffer))>0;)md.update(buffer,0,n);}StringBuilder value=new StringBuilder();for(byte b:md.digest())value.append(String.format("%02x",b));return value.toString();}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
}
