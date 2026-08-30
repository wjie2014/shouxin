package com.shouxin.qa.statistics;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;

import java.time.LocalDate;
import java.util.*;

@Component
@Order(20)
public class AnalysisSchemeBootstrap implements ApplicationRunner {
    private final JdbcTemplate jdbc; private final ObjectMapper mapper;
    public AnalysisSchemeBootstrap(JdbcTemplate jdbc,ObjectMapper mapper){this.jdbc=jdbc;this.mapper=mapper;}
    @Override public void run(ApplicationArguments args)throws Exception{
        Integer existing=jdbc.queryForObject("SELECT COUNT(*) FROM qa_analysis_scheme WHERE built_in=1",Integer.class);
        if(existing==null||existing>0)return;
        String owner=jdbc.queryForObject("SELECT id FROM sys_user WHERE username='admin'",String.class);
        if(owner==null||owner.isBlank())return;
        add("template-scale","知识库规模趋势","观察新增、发布和驳回变化",owner,"trend","domainL1","status");
        add("template-quality","目录内容质量","比较各目录发布、审核和驳回情况",owner,"cross","domainL1","status");
        add("template-efficiency","审批效率分析","分析审核人处理量、通过率和时长",owner,"efficiency","reviewer","status");
        add("template-overdue","待办积压与超期","识别超过审批时限的任务",owner,"overdue","domainL1","status");
        add("template-funnel","审批转化漏斗","查看提交到发布的转化过程",owner,"funnel","status","status");
        add("template-behavior","知识使用与反馈","统计搜索、命中、查看和满意度",owner,"behavior","eventType","status");
    }
    private void add(String id,String name,String description,String owner,String mode,String primary,String secondary)throws Exception{
        Map<String,Object> config=new LinkedHashMap<>();config.put("mode",mode);config.put("primaryDimension",primary);config.put("secondaryDimension",secondary);config.put("metrics",List.of("count"));config.put("dateRange",Map.of("from",LocalDate.now().minusDays(29).toString(),"to",LocalDate.now().toString(),"timeField","createdAt"));config.put("filters",Map.of("statuses",List.of(),"domainL1Ids",List.of(),"domainL2Ids",List.of(),"domainL3Ids",List.of(),"authorIds",List.of(),"reviewerIds",List.of()));config.put("granularity","day");config.put("sortBy","updatedAt");config.put("sortDir","desc");config.put("limit",20);config.put("comparePreviousPeriod",true);config.put("slaHours",24);config.put("page",1);config.put("pageSize",10);
        jdbc.update("INSERT INTO qa_analysis_scheme(id,scheme_name,description,owner_id,visibility,config_json,built_in) VALUES(?,?,?,?,'PUBLIC',?,1)",id,name,description,owner,mapper.writeValueAsString(config));
    }
}
