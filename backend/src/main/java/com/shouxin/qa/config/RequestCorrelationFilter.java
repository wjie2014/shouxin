package com.shouxin.qa.config;
import jakarta.servlet.FilterChain;import jakarta.servlet.ServletException;import jakarta.servlet.http.HttpServletRequest;import jakarta.servlet.http.HttpServletResponse;import org.slf4j.MDC;import org.springframework.core.Ordered;import org.springframework.core.annotation.Order;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;import java.io.IOException;import java.util.UUID;
@Component @Order(Ordered.HIGHEST_PRECEDENCE) public class RequestCorrelationFilter extends OncePerRequestFilter{
 private static final String HEADER="X-Request-Id";
 @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain)throws ServletException,IOException{String id=req.getHeader(HEADER);if(id==null||id.isBlank()||id.length()>64)id=UUID.randomUUID().toString();MDC.put("requestId",id);res.setHeader(HEADER,id);try{chain.doFilter(req,res);}finally{MDC.remove("requestId");}}
}
