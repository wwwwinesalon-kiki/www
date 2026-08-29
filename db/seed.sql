INSERT OR IGNORE INTO admin_users (id, access_email, role, created_at) VALUES ('admin-owner','owner@local.test','owner','2026-08-29T00:00:00.000Z');
INSERT OR IGNORE INTO members (id,name,line_name,email,status,joined_at,source,last_contact_at,interest_categories,notes,kaihipay_customer_id,created_at,updated_at) VALUES
('m1','山田 花子','hanako_wine','hanako@example.jp','active','2026-06-12','LINE','2026-08-25','["FIELD","TABLE"]','','kp_mock_1','2026-06-12T00:00:00.000Z','2026-08-29T00:00:00.000Z'),
('m2','佐藤 美咲','misaki','misaki@example.jp','pause','2025-11-03','イベント','2026-07-14','["PEOPLE"]','休会中',NULL,'2025-11-03T00:00:00.000Z','2026-08-29T00:00:00.000Z');
INSERT OR IGNORE INTO events (id,title,slug,event_type,description,start_at,end_at,venue,capacity,price,member_only,registration_enabled,waitlist_enabled,publish_status,public_visible,member_visible,cover_image,items_to_bring,precautions,created_at,updated_at) VALUES
('e1','余市の畑と、秋のテーブル','yoichi-autumn-table','FIELD訪問','畑を歩き、土地を味わう一日。','2026-09-19T11:00:00+09:00','2026-09-19T16:00:00+09:00','北海道・余市',20,5500,0,1,1,'published',1,1,NULL,'歩きやすい靴、帽子、飲み物','天候により変更の場合あり','2026-08-01T00:00:00.000Z','2026-08-29T00:00:00.000Z');
INSERT OR IGNORE INTO contents (id,type,title,slug,summary,body,tags,cover_image,audio,publish_status,public_visible,member_visible,published_at,created_at,updated_at) VALUES
('c1','FIELD','収穫前、余市の畑から','yoichi-before-harvest','実りの季節を待つ畑と、生産者の声。','現地で記録した一次情報です。','["余市","収穫"]',NULL,NULL,'published',0,1,'2026-08-20T00:00:00.000Z','2026-08-18T00:00:00.000Z','2026-08-20T00:00:00.000Z'),
('c2','PEOPLE','つくる人｜藤田さん','fujita-winemaker','この土地でワインをつくる理由を聞きました。','10分インタビュー。','["生産者"]',NULL,NULL,'published',1,1,'2026-08-15T00:00:00.000Z','2026-08-10T00:00:00.000Z','2026-08-15T00:00:00.000Z');
INSERT OR REPLACE INTO settings (key,value,updated_at) VALUES ('site_name','"Wine Work Women"','2026-08-29T00:00:00.000Z'),('session_lifetime_days','30','2026-08-29T00:00:00.000Z'),('member_password_version','"1"','2026-08-29T00:00:00.000Z');
INSERT OR IGNORE INTO notifications (id,type,title,body,created_at) VALUES ('n1','unpaid','未入金があります','2名・10,000円が未回収です','2026-08-29T00:00:00.000Z'),('n2','event_preparation','次回Event準備','余市イベントまで21日です','2026-08-29T00:00:00.000Z');
PRAGMA optimize;
