-- 问答版本在编辑时需要独立记录更新时间；既有数据以当前时间初始化。
ALTER TABLE qa_pair_version
    ADD updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL;
