ALTER TABLE qa_pair_version ADD field_scheme_id VARCHAR(36);
ALTER TABLE qa_pair_version ADD field_schema_snapshot CLOB;
ALTER TABLE qa_field_config ADD column_width INT DEFAULT 160 NOT NULL;
ALTER TABLE qa_field_config ADD align_mode VARCHAR(12) DEFAULT 'LEFT' NOT NULL;
ALTER TABLE qa_field_config ADD sortable INT DEFAULT 0 NOT NULL;

UPDATE qa_pair_version
SET field_scheme_id = (SELECT id FROM qa_field_scheme WHERE is_default = 1 AND enabled = 1 LIMIT 1)
WHERE field_scheme_id IS NULL;

CREATE INDEX idx_qpv_field_scheme ON qa_pair_version(field_scheme_id);

INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-notes','scheme-complete','notes','补充说明','RICH_TEXT',0,0,1,6,NULL,220,'LEFT',0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-notes');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-priority','scheme-complete','priority','优先级','INTEGER',0,1,1,7,NULL,100,'RIGHT',1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-priority');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-score','scheme-complete','confidenceScore','置信度','DECIMAL',0,1,0,8,NULL,110,'RIGHT',1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-score');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-effective-date','scheme-complete','effectiveDate','生效日期','DATE',0,1,1,9,NULL,130,'CENTER',1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-effective-date');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-review-at','scheme-complete','reviewAt','复核时间','DATETIME',0,0,0,10,NULL,170,'CENTER',1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-review-at');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-tags','scheme-complete','tags','知识标签','MULTI_ENUM',0,1,1,11,'{"options":["安全","质量","设备","工艺","管理"]}',180,'LEFT',0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-tags');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-region','scheme-complete','region','适用区域','CASCADE',0,1,1,12,'{"options":[{"label":"总部","value":"hq","children":[{"label":"生产中心","value":"production"},{"label":"管理中心","value":"management"}]},{"label":"分支机构","value":"branch","children":[{"label":"华东","value":"east"},{"label":"华南","value":"south"}]}]}',180,'LEFT',0 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-region');
INSERT INTO qa_field_config(id,scheme_id,field_code,field_name,field_type,required,list_visible,searchable,sort_order,options_json,column_width,align_mode,sortable)
SELECT 'complete-public','scheme-complete','isPublic','是否公开','BOOLEAN',0,1,0,13,NULL,100,'CENTER',1 FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM qa_field_config WHERE id='complete-public');
