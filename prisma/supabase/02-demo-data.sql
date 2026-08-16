-- ============================================================================
-- 家庭安心管家 — Supabase 预览环境演示数据
-- ============================================================================
--
-- ⚠️ 本文件生成的全部家庭、长辈、家庭成员、安心专员、学历、培训、服务记录、
--    报告与订单都是【为便于演示而虚构的示例数据】，每条都带 isDemo = true。
--    不代表公司真实客户、真实员工背景或真实服务案例，
--    不得用于对外宣传、招商或作为公司业绩案例展示。
--
-- 用途：在没有本地 Node 环境的情况下，把预览环境一次灌满。
--       它与 prisma/seed.ts 生成的是同一套故事（相同手机号、相同家庭），
--       但字段覆盖略少。如果你之后能在本地跑 `npm run db:seed`，
--       那一份是维护主线，直接跑即可（seed.ts 会先清空再写入，不会冲突）。
--
-- 密码：演示帐号统一 Demo@2026，哈希由数据库端 pgcrypto 现场生成
--       （bcrypt cost 12，格式 $2a$，bcryptjs 可校验）。
--       正式部署必须重置全部密码，并把 NEXT_PUBLIC_DEMO_MODE 设为 false。
-- ============================================================================

SET search_path TO app, extensions, public;

-- 注意：本文件假设表已由 01-schema.sql 建在 app schema。
-- 应用连接串必须带 ?schema=app，否则 Prisma 会去 public 找表。

BEGIN;

-- ---------------------------------------------------------------------------
-- 时间辅助函数
--
-- 演示数据的时间必须「永远落在本周」，否则今天打开看到的是空列表。
-- 数据库存 UTC，界面按 Asia/Shanghai 展示，所以这里统一按上海挂钟时间写，
-- 再减 8 小时存库。
-- ---------------------------------------------------------------------------

-- 本周第 dow 天（0=周一）的上海挂钟 sh_hour:sh_min，转成 UTC
CREATE OR REPLACE FUNCTION app.demo_ts(dow int, sh_hour int, sh_min int DEFAULT 0)
RETURNS timestamp(3) LANGUAGE sql STABLE AS $$
  SELECT (
    date_trunc('week', (now() AT TIME ZONE 'Asia/Shanghai'))
    + make_interval(days => dow, hours => sh_hour, mins => sh_min)
    - interval '8 hours'
  )::timestamp(3)
$$;

-- 同上，但保证「已经发生过」：若该时刻还没到，就退回三小时前
CREATE OR REPLACE FUNCTION app.demo_past(dow int, sh_hour int, sh_min int DEFAULT 0)
RETURNS timestamp(3) LANGUAGE sql STABLE AS $$
  SELECT LEAST(app.demo_ts(dow, sh_hour, sh_min),
               (now() - interval '3 hours')::timestamp(3))
$$;

-- 同上，但保证「还没发生」：若该时刻已过，就顺延到下周同一天
CREATE OR REPLACE FUNCTION app.demo_future(dow int, sh_hour int, sh_min int DEFAULT 0)
RETURNS timestamp(3) LANGUAGE sql STABLE AS $$
  SELECT (CASE
    WHEN app.demo_ts(dow, sh_hour, sh_min) > (now() + interval '2 hours')::timestamp
      THEN app.demo_ts(dow, sh_hour, sh_min)
      ELSE app.demo_ts(dow, sh_hour, sh_min) + interval '7 days'
  END)::timestamp(3)
$$;

CREATE OR REPLACE FUNCTION app.demo_ago(days numeric)
RETURNS timestamp(3) LANGUAGE sql STABLE AS $$
  SELECT (now() - make_interval(mins => (days * 1440)::int))::timestamp(3)
$$;

-- 演示口令的 bcrypt 哈希（cost 12）。全部演示帐号共用同一个值。
CREATE OR REPLACE FUNCTION app.demo_pwd() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT extensions.crypt('Demo@2026', extensions.gen_salt('bf', 12))
$$;

-- ===========================================================================
-- 1. 城市与区域 —— 首个运营城市：湖南长沙
-- ===========================================================================
INSERT INTO cities (id, name, province, "isActive") VALUES
  ('city_cs', '长沙', '湖南', true);

INSERT INTO districts (id, "cityId", name) VALUES
  ('dist_yuelu',  'city_cs', '岳麓区'),
  ('dist_kaifu',  'city_cs', '开福区'),
  ('dist_tianxin','city_cs', '天心区'),
  ('dist_yuhua',  'city_cs', '雨花区'),
  ('dist_furong', 'city_cs', '芙蓉区');

-- ===========================================================================
-- 2. 培训课程 —— 公司内部培训，不等同任何法定资格
-- ===========================================================================
INSERT INTO training_courses
  (id, title, type, description, "creditHours", "isMandatory", "validMonths", "requiresExam", "passingScore", "isActive", "updatedAt")
VALUES
  ('crs_philo','家庭安心服务理念','SERVICE_PHILOSOPHY','我们做的是「让子女放心」的陪伴与生活协助，不是医疗护理。明确服务边界。',4,true,NULL,true,80,true,now()),
  ('crs_comm','与长辈的沟通方式','ELDER_COMMUNICATION','怎么问、怎么听、怎么不越界。含听力下降、记性变差、不愿麻烦子女等常见情境。',6,true,NULL,true,80,true,now()),
  ('crs_proc','上门服务标准流程','SERVICE_PROCESS','到达、确认、服务、记录、离开。每一步该说什么、该记什么。',6,true,12,true,80,true,now()),
  ('crs_safe','居家安全与风险识别','SAFETY','识别地面湿滑、照明不足、燃气与用电隐患。只做提示与上报，不做改造承诺。',4,true,12,true,85,true,now()),
  ('crs_priv','个人信息保护与隐私边界','PRIVACY','哪些能问、哪些不能记、哪些不能对家属说。授权是有边界的。',4,true,12,true,90,true,now()),
  ('crs_inc','异常情况处理','INCIDENT_HANDLING','联系不上长辈、长辈说不舒服、跌倒、家庭矛盾时的处置顺序与上报要求。',6,true,12,true,85,true,now()),
  ('crs_prac','实操考核','PRACTICAL_ASSESSMENT','由服务督导陪同上门，现场评估沟通、记录与应变。',8,true,NULL,true,80,true,now());

-- ===========================================================================
-- 3. 能力标签
--
-- requiresCredential = true 的标签必须有真实证件号才能授予 ——
-- 公司自己的培训不等于法定资格，这条在服务层强制校验。
-- ===========================================================================
INSERT INTO competencies
  (id, name, code, description, "requiresCredential", "requiredForServices")
VALUES
  ('cap_visit','上门安心探访','HOME_VISIT_BASIC','可独立完成常规上门陪伴、生活观察与服务记录。',false,'{HOME_VISIT,EXTRA_VISIT}'),
  ('cap_phone','电话关怀','PHONE_CARE','可独立完成定期电话问候与情况确认。',false,'{PHONE_CARE}'),
  ('cap_daily','生活协助与代办','DAILY_ASSIST','可协助代购、陪同办事、家居整理。',false,'{DAILY_ASSISTANCE}'),
  ('cap_escort','陪诊协助','MEDICAL_ESCORT','陪同挂号、就诊流程协助与陪伴。不提供任何医疗判断或用药建议。',false,'{MEDICAL_ESCORT}'),
  ('cap_assess','家庭安心评估','HOUSEHOLD_ASSESSMENT','可独立完成首次上门评估并给出方案建议。',false,'{ASSESSMENT}'),
  ('cap_firstaid','急救证书','FIRST_AID_CERT','持有有效急救培训证书。属法定资格类，必须登记证件号。',true,'{}');
UPDATE competencies SET "isActive" = true;

-- ===========================================================================
-- 4. 服务方案
-- ===========================================================================
INSERT INTO service_plans
  (id, code, name, tier, description, "monthlyPrice", "visitsPerMonth", "phoneCarePerMonth", "reportsPerMonth", "includedServices", "isActive", "sortOrder", "updatedAt")
VALUES
  ('plan_care','CARE','关怀版','CARE','以电话关怀为主，每月一次上门。适合子女在本地、但工作日无法常回家的家庭。',39900,1,8,4,'{HOME_VISIT,PHONE_CARE}',true,1,now()),
  ('plan_assu','ASSURANCE','安心版','ASSURANCE','每周一次上门探访、每周两次电话关怀、每周一份安心报告。我们最推荐的方案。',79900,4,8,4,'{HOME_VISIT,PHONE_CARE,DAILY_ASSISTANCE}',true,2,now()),
  ('plan_stew','STEWARD','管家版','STEWARD','每周两次上门、含陪诊协助与生活代办。适合子女在外地、长辈行动不便的家庭。',159900,8,12,4,'{HOME_VISIT,PHONE_CARE,MEDICAL_ESCORT,DAILY_ASSISTANCE}',true,3,now());

-- ===========================================================================
-- 5. 服务目录
--
-- 这张表是「家庭端能自助申请哪几类服务」的唯一来源，前端不写死白名单。
-- familyRequestable = true 的必须有加购价格（服务层会拒绝没标价的）。
-- ===========================================================================
INSERT INTO service_catalog_items
  (id, "serviceType", "displayName", description, "defaultMinutes", "addOnPrice", "familyRequestable", "requiresCompetency", "isActive", "sortOrder", "updatedAt")
VALUES
  ('cat_visit','HOME_VISIT','上门安心探访','安心专员上门陪伴、生活观察与协助，服务结束后形成服务记录。',60,NULL,false,true,true,1,now()),
  ('cat_phone','PHONE_CARE','电话关怀','定期电话问候，确认长辈近况与需求。',15,NULL,false,false,true,2,now()),
  ('cat_assess','ASSESSMENT','家庭安心评估','由家庭安心顾问上门完成，用于确定服务方案与注意事项。',90,NULL,false,true,true,3,now()),
  ('cat_escort','MEDICAL_ESCORT','陪诊协助','陪同挂号、就诊流程协助与陪伴，不提供任何医疗判断或用药建议。',180,29900,true,true,true,4,now()),
  ('cat_extra','EXTRA_VISIT','额外探访','在原有方案之外增加一次上门陪伴与生活协助。',60,12900,true,true,true,5,now()),
  ('cat_daily','DAILY_ASSISTANCE','生活代办','代购生活用品、协助日常事务办理。',60,9900,true,false,true,6,now());

-- ===========================================================================
-- 6. 通知模板
--
-- availableVars 是占位符白名单；服务层拒绝白名单外的变量，
-- 避免有人把敏感字段拼进短信。requiredPermission 表示这条通知要发给
-- 家庭成员时必须先有对应授权 —— 通知也是一种数据出口。
-- 第一版只真正实现站内通知，其余渠道保持关闭而不是假装已接通。
-- ===========================================================================
INSERT INTO notification_templates
  (id, event, name, level, "titleTemplate", "bodyTemplate", "availableVars", "enabledChannels", "requiredPermission", "isActive", "updatedAt")
VALUES
  ('tpl_done','SERVICE_COMPLETED','服务完成','NORMAL',
   '{{elderName}}的{{serviceType}}已完成',
   '{{specialistName}} 于 {{serviceTime}} 完成本次服务，服务记录审核后会同步给您。',
   '{"{{elderName}}","{{serviceType}}","{{specialistName}}","{{serviceTime}}"}','{IN_APP}','SERVICE_SCHEDULE',true,now()),
  ('tpl_report','REPORT_PUBLISHED','安心报告已发布','NORMAL',
   '{{elderName}}的安心报告已经可以查看',
   '{{periodStart}} 至 {{periodEnd}} 的《{{reportTitle}}》已发布。',
   '{"{{elderName}}","{{reportTitle}}","{{periodStart}}","{{periodEnd}}"}','{IN_APP}','ASSURANCE_REPORT',true,now()),
  ('tpl_next','NEXT_SERVICE_REMINDER','下次服务提醒','NORMAL',
   '{{elderName}}下次服务：{{serviceTime}}',
   '{{specialistName}} 将上门进行{{serviceType}}。如需改期可在服务页面提交申请。',
   '{"{{elderName}}","{{serviceType}}","{{serviceTime}}","{{specialistName}}"}','{IN_APP}','SERVICE_SCHEDULE',true,now()),
  ('tpl_spec','SPECIALIST_CHANGED','安心专员变更','IMPORTANT',
   '{{elderName}}的安心专员有调整',
   '由 {{fromSpecialist}} 调整为 {{toSpecialist}}。原因：{{reason}}。',
   '{"{{elderName}}","{{fromSpecialist}}","{{toSpecialist}}","{{reason}}"}','{IN_APP}','SERVICE_SCHEDULE',true,now()),
  ('tpl_sched','SCHEDULE_CHANGED','服务时间调整','IMPORTANT',
   '{{elderName}}的服务时间已调整',
   '原定 {{oldTime}}，调整为 {{newTime}}。原因：{{reason}}。',
   '{"{{elderName}}","{{oldTime}}","{{newTime}}","{{reason}}"}','{IN_APP}','SERVICE_SCHEDULE',true,now()),
  ('tpl_expire','MEMBERSHIP_EXPIRING','会员即将到期','IMPORTANT',
   '{{householdName}}的{{planName}}将于 {{expireDate}} 到期',
   '如需继续服务，可以联系我们办理续费。',
   '{"{{householdName}}","{{planName}}","{{expireDate}}"}','{IN_APP}',NULL,true,now()),
  ('tpl_inc','INCIDENT_URGENT','紧急异常通知','URGENT',
   '{{elderName}}发生{{incidentType}}，请尽快查看',
   '{{occurredAt}}：{{description}}。我们已在处理，会持续与您同步。',
   '{"{{elderName}}","{{incidentType}}","{{description}}","{{occurredAt}}"}','{IN_APP}','INCIDENT_ALERT',true,now()),
  ('tpl_reach','CANNOT_REACH_ELDER','联系不上长辈','URGENT',
   '暂时联系不上{{elderName}}',
   '{{specialistName}} 于 {{occurredAt}} 未能联系到长辈，正在按流程核实，请留意来电。',
   '{"{{elderName}}","{{specialistName}}","{{occurredAt}}"}','{IN_APP}','INCIDENT_ALERT',true,now());

-- ===========================================================================
-- 7. 内部帐号
-- ===========================================================================
INSERT INTO users (id, name, phone, email, "passwordHash", role, status, "cityId", "isDemo", "updatedAt") VALUES
  ('usr_admin','示例·超级管理员','13800000001','admin@example.com',app.demo_pwd(),'SUPER_ADMIN','ACTIVE','city_cs',true,now()),
  ('usr_ops','示例·运营 张敏','13800000002',NULL,app.demo_pwd(),'OPERATIONS','ACTIVE','city_cs',true,now()),
  ('usr_sup','示例·服务督导 陈静','13800000003',NULL,app.demo_pwd(),'SERVICE_SUPERVISOR','ACTIVE','city_cs',true,now()),
  ('usr_fin','示例·财务 赵磊','13800000004',NULL,app.demo_pwd(),'FINANCE','ACTIVE','city_cs',true,now()),
  ('usr_hr','示例·人事 孙悦','13800000005',NULL,app.demo_pwd(),'HR','ACTIVE','city_cs',true,now()),
  ('usr_cs','示例·客服 何雨','13800000006',NULL,app.demo_pwd(),'CUSTOMER_SERVICE','ACTIVE','city_cs',true,now()),
  ('usr_city','示例·长沙城市负责人 罗成','13800000007',NULL,app.demo_pwd(),'CITY_LEAD','ACTIVE','city_cs',true,now()),
  ('usr_area','示例·岳麓区服务主管 邓琳','13800000008',NULL,app.demo_pwd(),'AREA_MANAGER','ACTIVE','city_cs',true,now()),
  ('usr_cons','示例·家庭安心顾问 张宁','13800000010',NULL,app.demo_pwd(),'FAMILY_CONSULTANT','ACTIVE','city_cs',true,now()),
  ('usr_li','示例·李晨','13800000011',NULL,app.demo_pwd(),'CARE_SPECIALIST','ACTIVE','city_cs',true,now()),
  ('usr_zhou','示例·周敏','13800000012',NULL,app.demo_pwd(),'CARE_SPECIALIST','ACTIVE','city_cs',true,now()),
  ('usr_wu','示例·培训中 吴桐','13800000013',NULL,app.demo_pwd(),'CARE_SPECIALIST','ACTIVE','city_cs',true,now()),
  ('usr_wangd','示例·王女士','13800000021','wang@example.com',app.demo_pwd(),'FAMILY_MEMBER','ACTIVE',NULL,true,now()),
  ('usr_wangs','示例·王先生','13800000022',NULL,app.demo_pwd(),'FAMILY_MEMBER','ACTIVE',NULL,true,now()),
  ('usr_lius','示例·刘先生','13800000031',NULL,app.demo_pwd(),'FAMILY_MEMBER','ACTIVE',NULL,true,now());

-- ===========================================================================
-- 8. 安心专员档案
--
-- 刻意保留一个未上岗的人（吴桐，IN_TRAINING），用来验证
-- 「非可排班状态不可派单」这道闸门真的会拦住。
-- ===========================================================================
INSERT INTO staff_profiles
  (id, "userId", "employeeCode", "staffLevel", "cityId", "districtId", "employmentStatus", "serviceStatus", bio, "hiredAt", "isDemo", "updatedAt")
VALUES
  ('stf_cons','usr_cons','AX-0001','SENIOR','city_cs','dist_yuelu','ONBOARDED','ACTIVE',
   '（示例数据）负责家庭前期沟通、需求了解与家庭安心评估。',app.demo_ago(400),true,now()),
  ('stf_li','usr_li','AX-0007','INTERMEDIATE','city_cs','dist_yuelu','ONBOARDED','ACTIVE',
   '（示例数据）擅长与长辈建立稳定的日常关系，习惯把观察到的细节写清楚。',app.demo_ago(300),true,now()),
  ('stf_zhou','usr_zhou','AX-0009','JUNIOR','city_cs','dist_kaifu','ONBOARDED','ACTIVE',
   '（示例数据）主要负责开福区，兼任部分家庭的备用安心专员。',app.demo_ago(180),true,now()),
  ('stf_wu','usr_wu','AX-0014','TRAINEE','city_cs','dist_yuelu','ONBOARDED','IN_TRAINING',
   NULL,app.demo_ago(20),true,now());

-- 学历：李晨已核验；周敏提交了但还没核验 —— 用于验证界面不得标示「已认证」
INSERT INTO education_records
  (id, "staffProfileId", school, major, level, "graduationYear", "verificationStatus", "verifiedById", "verifiedAt", "evidenceKey", "isDemo", "updatedAt")
VALUES
  ('edu_li','stf_li','（示例）长沙民政职业技术学院','老年服务与管理','JUNIOR_COLLEGE',2016,'VERIFIED','usr_hr',app.demo_ago(280),
   'private/staff/stf_li/edu/diploma.pdf',true,now()),
  ('edu_zhou','stf_zhou','（示例）湖南女子学院','社会工作','BACHELOR',2019,'PENDING',NULL,NULL,
   'private/staff/stf_zhou/edu/diploma.pdf',true,now()),
  ('edu_cons','stf_cons','（示例）中南大学','社会学','BACHELOR',2012,'VERIFIED','usr_hr',app.demo_ago(390),
   'private/staff/stf_cons/edu/diploma.pdf',true,now());

-- 培训：李晨 / 周敏 / 顾问全部必修通过；吴桐仍在培训中（含一门待考核）
INSERT INTO training_records
  (id, "staffProfileId", "courseId", status, "startedAt", "completedAt", "creditHours", "examScore", "instructorName", "isDemo", "updatedAt")
SELECT
  'trn_' || s.sid || '_' || c.id,
  s.sid, c.id, 'PASSED',
  app.demo_ago(s.off + 10), app.demo_ago(s.off), c."creditHours", s.score, '示例·服务督导 陈静', true, now()
FROM (VALUES ('stf_li', 260, 92), ('stf_zhou', 150, 88), ('stf_cons', 370, 95)) AS s(sid, off, score)
CROSS JOIN training_courses c;

INSERT INTO training_records
  (id, "staffProfileId", "courseId", status, "startedAt", "completedAt", "creditHours", "examScore", "instructorName", remark, "isDemo", "updatedAt")
VALUES
  ('trn_wu_philo','stf_wu','crs_philo','PASSED',app.demo_ago(18),app.demo_ago(16),4,86,'示例·服务督导 陈静',NULL,true,now()),
  ('trn_wu_comm','stf_wu','crs_comm','PASSED',app.demo_ago(15),app.demo_ago(12),6,84,'示例·服务督导 陈静',NULL,true,now()),
  ('trn_wu_proc','stf_wu','crs_proc','PENDING_EXAM',app.demo_ago(10),NULL,6,NULL,'示例·服务督导 陈静','（示例）课程已学完，等待安排考核。',true,now()),
  ('trn_wu_safe','stf_wu','crs_safe','IN_PROGRESS',app.demo_ago(6),NULL,4,NULL,'示例·服务督导 陈静',NULL,true,now());

-- 能力标签授予：李晨可做探访/电话/生活协助/陪诊；周敏尚未拿到陪诊
-- credentialStatus 走默认值 UNVERIFIED：这些是公司内部认定的能力，
-- 不涉及外部资格凭证。cap_firstaid（急救证书）刻意谁都没有 ——
-- 没有真实证件号就不该授予，这条在服务层强制。
INSERT INTO staff_competencies
  (id, "staffProfileId", "competencyId", "grantedAt", "isDemo")
VALUES
  ('sc_li_visit','stf_li','cap_visit',app.demo_ago(250),true),
  ('sc_li_phone','stf_li','cap_phone',app.demo_ago(250),true),
  ('sc_li_daily','stf_li','cap_daily',app.demo_ago(200),true),
  ('sc_li_escort','stf_li','cap_escort',app.demo_ago(120),true),
  ('sc_zhou_visit','stf_zhou','cap_visit',app.demo_ago(140),true),
  ('sc_zhou_phone','stf_zhou','cap_phone',app.demo_ago(140),true),
  ('sc_cons_assess','stf_cons','cap_assess',app.demo_ago(360),true),
  ('sc_cons_visit','stf_cons','cap_visit',app.demo_ago(360),true);

-- 不可排班时间：由专员自己申报，不是定位也不是考勤
INSERT INTO staff_availability (id, "staffProfileId", "startAt", "endAt", reason, "isBlocked")
VALUES ('avl_zhou','stf_zhou',app.demo_ts(5, 8, 0),app.demo_ts(5, 18, 0),'（示例）家里有事，周六全天不方便',true);

-- 绩效快照：以服务质量为主，刻意不做单量排行榜
INSERT INTO staff_performance_snapshots
  (id, "staffProfileId", "periodStart", "periodEnd", "onTimeRate", "completionRate", "recordTimelyRate",
   "reportQualityScore", "familyRatingAvg", "complaintCount", "incidentCooperation", "trainingCompletion",
   "retainedHouseholds", "taskCount")
VALUES
  ('sn_li','stf_li',app.demo_ago(35),app.demo_ago(7),0.96,0.98,1.00,4.6,4.8,0,1.00,1.00,6,24),
  ('sn_zhou','stf_zhou',app.demo_ago(35),app.demo_ago(7),0.91,0.95,0.92,4.2,4.5,0,0.95,1.00,4,17);

-- ===========================================================================
-- 9. 家庭一：王家（完整主流程）
-- ===========================================================================
INSERT INTO households
  (id, "householdCode", name, "cityId", "districtId", "addressLine", status,
   "consultantId", "primarySpecialistId", "backupSpecialistId", "serviceNotes", "internalNotes", "joinedAt", "isDemo", "updatedAt")
VALUES
  ('hh_wang','CS-000018','王家','city_cs','dist_yuelu','（示例）岳麓区银盆岭街道××小区 3 栋 2 单元','ACTIVE_MEMBER',
   'usr_cons','stf_li','stf_zhou',
   '（示例）长辈耳背，敲门要久一点、说话放慢。喜欢聊以前在纺织厂的事。',
   '（示例）女儿在深圳工作，沟通主要走微信；儿子在长沙本地但工作忙。',
   app.demo_ago(120),true,now());

INSERT INTO elders
  (id, "householdId", name, gender, birthday, phone, address, "livingStatus", "mobilityStatus",
   "dailyRoutine", "activityNotes", "dietNotes", "sleepNotes", "communicationPrefs",
   "livingArrangement", "familyRelations", "dailyNeeds", "attentionNotes", "emergencyArrangement", "generalNotes",
   "isDemo", "updatedAt")
VALUES
  ('eld_wangm','hh_wang','王秀兰','FEMALE','1948-04-12',
   '13900000018','（示例）岳麓区银盆岭街道××小区 3 栋 2 单元 602','ALONE','SLOW_BUT_INDEPENDENT',
   '（示例）早上六点多起床，去小区里走两圈。中午看电视，下午常和邻居在楼下坐着聊天。',
   '（示例）能自己上下楼，但下楼慢，会扶着扶手。',
   '（示例）口味偏清淡，不爱吃太硬的东西。喜欢喝小米粥。',
   '（示例）说自己睡得浅，有时半夜会醒一次。',
   '（示例）耳背，说话要放慢、面对着说。不太会用微信语音，打电话更好。',
   '（示例）独居。老伴前几年去世，女儿在深圳，儿子在长沙但住得远。',
   '（示例）女儿王女士（付款人、主要联络人）、儿子王先生。',
   '（示例）希望有人定期来陪着说说话，帮忙看看家里有没有需要修的。',
   '（示例）下楼台阶处光线暗，提醒她开灯再走。膝盖她自己说上下楼会疼。',
   '（示例）先联系女儿王女士；联系不上再联系儿子王先生；紧急情况联系楼下邻居李阿姨（示例·门房登记）。',
   '（示例）比较不愿意麻烦子女，问她「有没有需要」常说「都好」，要多观察。',
   true,now());

-- 健康敏感信息：独立一张表，一线安心专员一律看不到
INSERT INTO elder_sensitive_info
  (id, "elderId", "chronicConditions", medications, allergies, "medicalDocsNotes",
   "bpSystolicMax", "bpDiastolicMax", "glucoseMax", "updatedById", "updatedAt")
VALUES
  ('esi_wangm','eld_wangm',
   '（示例·家庭自述）高血压多年，膝关节不舒服。这里记录的是家庭告诉我们的情况，不是诊断结论。',
   '（示例·家庭自述）每天早上一片降压药，具体名称家属说下次拍照片给我们。',
   '（示例·家庭自述）说吃海鲜会起疹子。',
   '（示例）家属提供过一张体检单照片，存在私有对象存储，仅授权角色可查看。',
   140,90,NULL,'usr_ops',now());

INSERT INTO family_members
  (id, "userId", "householdId", "elderId", relationship, "isPayer", "isPrimaryContact", "isEmergencyContact", "isDemo", "updatedAt")
VALUES
  ('fm_wangd','usr_wangd','hh_wang','eld_wangm','DAUGHTER',true,true,true,true,now()),
  ('fm_wangs','usr_wangs','hh_wang','eld_wangm','SON',false,false,true,true,now());

UPDATE households SET "primaryContactId" = 'fm_wangd' WHERE id = 'hh_wang';

-- ---------------------------------------------------------------------------
-- 授权 —— 付款权 ≠ 数据查看权
--
-- 王女士是付款人 + 主要联络人 + 紧急联络人，仍然刻意【没有】
-- SENSITIVE_HEALTH 授权：慢性情况与用药她看不到。
-- 这是整个产品最重要的一条边界，演示时请重点看这里。
-- ---------------------------------------------------------------------------
INSERT INTO consents
  (id, "elderId", "grantorId", "granteeId", "permissionType", scope, "grantedAt", status, version, basis, "isDemo", "updatedAt")
VALUES
  ('cst_d_report','eld_wangm','usr_wangd','usr_wangd','ASSURANCE_REPORT',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_d_life','eld_wangm','usr_wangd','usr_wangd','LIFE_RECORD',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_d_sched','eld_wangm','usr_wangd','usr_wangd','SERVICE_SCHEDULE',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_d_inc','eld_wangm','usr_wangd','usr_wangd','INCIDENT_ALERT',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_d_photo','eld_wangm','usr_wangd','usr_wangd','PHOTO',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_d_contact','eld_wangm','usr_wangd','usr_wangd','CONTACT_INFO',NULL,app.demo_ago(118),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  -- 王先生只有两项：服务安排 + 异常通知
  ('cst_s_sched','eld_wangm','usr_wangd','usr_wangs','SERVICE_SCHEDULE',NULL,app.demo_ago(110),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_s_inc','eld_wangm','usr_wangd','usr_wangs','INCIDENT_ALERT',NULL,app.demo_ago(110),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now());

-- 一条已撤回的历史授权 —— 撤回立即失效，但记录永不删除
INSERT INTO consents
  (id, "elderId", "grantorId", "granteeId", "permissionType", "grantedAt", "revokedAt", status, version, basis, "isDemo", "updatedAt")
VALUES
  ('cst_s_life','eld_wangm','usr_wangd','usr_wangs','LIFE_RECORD',app.demo_ago(100),app.demo_ago(45),'REVOKED',1,'ELDER_VERBAL_WITNESSED',true,now());

-- 家庭安心评估（由顾问上门完成）
INSERT INTO household_assessments
  (id, "householdId", "elderId", "assessorName", "assessedAt", "livingSummary", "needsSummary", "riskNotes", "recommendedTier", recommendation, "isDemo")
VALUES
  ('asm_wang','hh_wang','eld_wangm','示例·家庭安心顾问 张宁',app.demo_ago(119),
   '（示例）独居六楼有电梯，家里整洁。厨房光线好，卫生间没有扶手。',
   '（示例）主要需要固定的陪伴与生活协助，子女希望每周能看到情况反馈。',
   '（示例）卫生间地面湿滑、下楼台阶处照明不足。已口头提示家属加装扶手与夜灯。',
   'ASSURANCE',
   '（示例）建议安心版：每周一次上门 + 每周两次电话 + 每周一份报告。固定专员优先安排熟悉岳麓区的同事。',
   true);

-- 家庭执行计划（把方案落成具体的周节奏）
INSERT INTO household_service_plans
  (id, "householdId", "planId", "visitsPerWeek", "phoneCarePerWeek", "reportsPerWeek",
   "preferredWeekday", "preferredWindow", "executionNotes", "startDate", "isActive", "isDemo", "updatedAt")
VALUES
  ('hsp_wang','hh_wang','plan_assu',1,2,1,4,'14:00-16:00',
   '（示例）长辈下午精神比较好。敲门久一点，她耳背。每次去之前先打个电话。',
   app.demo_ago(118),true,true,now());

-- 订阅与订单（含三种开票状态，方便看发票页的待办）
INSERT INTO subscriptions
  (id, "householdId", "planId", status, "startDate", "currentPeriodStart", "currentPeriodEnd",
   "monthlyPrice", "autoRenew", "usedVisits", "usedPhoneCare", "usedReports", "isDemo", "updatedAt")
VALUES
  ('sub_wang','hh_wang','plan_assu','ACTIVE',app.demo_ago(118),app.demo_ago(18),app.demo_ago(-12),
   79900,true,3,5,3,true,now());

INSERT INTO orders
  (id, "orderNo", "householdId", "subscriptionId", type, status, amount, currency, description, "paidAt",
   "invoiceStatus", "invoiceType", "invoiceTitle", "invoiceTaxNo", "invoiceNo", "invoicedAt", "invoiceNote", "isDemo", "updatedAt")
VALUES
  ('ord_w1','ORD-' || to_char(app.demo_ago(118),'YYYYMMDD') || '-0001','hh_wang','sub_wang','NEW_SUBSCRIPTION','PAID',
   239700,'CNY','安心版 × 3 个月',app.demo_ago(118),
   'ISSUED','PERSONAL_ELECTRONIC','王秀兰',NULL,'DEMO-00000001',app.demo_ago(116),NULL,true,now()),
  ('ord_w2','ORD-' || to_char(app.demo_ago(18),'YYYYMMDD') || '-0001','hh_wang','sub_wang','RENEWAL','PAID',
   79900,'CNY','安心版 续费 1 个月',app.demo_ago(18),
   'REQUESTED','COMPANY_ELECTRONIC','长沙示例科技有限公司','91430100DEMO0000XX',NULL,NULL,
   '示例数据：税号为占位内容，不对应任何真实企业',true,now());

-- ===========================================================================
-- 10. 王家本周的任务与服务记录
-- ===========================================================================

-- (1) 本周已完成的上门探访 —— 主流程的核心样本
INSERT INTO service_tasks
  (id, "taskNo", "householdId", "elderId", "staffProfileId", "serviceType", status,
   "scheduledStart", "estimatedMinutes", "addressLine", "taskItems", "attentionSnapshot",
   "isBackupAssignment", "acceptedAt", "arrivedAt", "startedAt", "endedAt", "isDemo", "updatedAt")
VALUES
  ('tsk_w_visit','TSK-' || to_char(app.demo_past(3,14,0),'YYYYMMDD') || '-0031','hh_wang','eld_wangm','stf_li','HOME_VISIT','COMPLETED',
   app.demo_past(3,14,0),60,'（示例）岳麓区银盆岭街道××小区 3 栋 2 单元 602',
   '{陪伴聊天,生活情况观察,协助整理居家环境,确认用药是否按时（仅确认，不指导用药）}',
   '（示例）耳背，说话放慢面对着说。下楼台阶处光线暗。',
   false,
   app.demo_past(3,14,0) - interval '20 hours',
   app.demo_past(3,14,0) + interval '4 minutes',
   app.demo_past(3,14,0) + interval '6 minutes',
   app.demo_past(3,14,0) + interval '68 minutes',
   true,now());

INSERT INTO visit_records
  (id, "taskId", "householdId", "elderId", "staffProfileId",
   "spiritLevel", "spiritNote", "dietLevel", "dietNote", "sleepLevel", "sleepNote", "activityLevel", "activityNote",
   "completedItems", "observationText", "photoKeys", "submittedAt", "reviewedById", "reviewedAt", "reviewNote", "isDemo", "updatedAt")
VALUES
  ('vr_w_visit','tsk_w_visit','hh_wang','eld_wangm','stf_li',
   'NORMAL','（示例）今天精神不错，主动讲了以前在纺织厂上班的事。',
   'FAIR','（示例）本人说这两天胃口一般，中午只吃了半碗饭。',
   'SELF_REPORTED_ISSUE','（示例）本人说昨晚约凌晨一点才入睡，说是电视看久了。',
   'FAIR','（示例）在客厅和楼道走动，下楼时扶着扶手，比较慢。',
   '{陪伴聊天,生活情况观察,协助整理居家环境}',
   '（示例）阳台晾衣绳有点松，已帮忙收紧。长辈自己提到膝盖上下楼会疼，说已经跟女儿讲过。厨房燃气软管看起来有老化痕迹，已提醒家属找物业检查。',
   '{private/visits/vr_w_visit/1.jpg,private/visits/vr_w_visit/2.jpg}',
   app.demo_past(3,14,0) + interval '75 minutes',
   'usr_sup', app.demo_past(3,14,0) + interval '4 hours',
   '（示例）记录清楚，观察性措辞使用得当。已确认没有出现病名或诊断表述。',
   true,now());

-- 健康数值：必须记录来源；超出的是「家庭设定的提醒范围」，不是诊断
INSERT INTO health_readings
  (id, "elderId", "visitRecordId", type, source, "valuePrimary", "valueSecondary", unit, "measuredAt", note, "outsideFamilyRange", "isDemo")
VALUES
  ('hr_w1','eld_wangm','vr_w_visit','BLOOD_PRESSURE','ELDER_SELF_MEASURED',152,88,'mmHg',
   app.demo_past(3,14,0) + interval '30 minutes',
   '（示例）长辈自己用家里的血压计测的，安心专员在旁记录。',true,true),
  ('hr_w2','eld_wangm',NULL,'BLOOD_PRESSURE','FAMILY_PROVIDED',134,82,'mmHg',
   app.demo_ago(9),'（示例）女儿在微信上发来的数值。',false,true);

-- (2) 本周待记录/待审核的电话关怀
INSERT INTO service_tasks
  (id, "taskNo", "householdId", "elderId", "staffProfileId", "serviceType", status,
   "scheduledStart", "estimatedMinutes", "startedAt", "endedAt", "isDemo", "updatedAt")
VALUES
  ('tsk_w_phone','TSK-' || to_char(app.demo_past(1,10,0),'YYYYMMDD') || '-0022','hh_wang','eld_wangm','stf_li','PHONE_CARE','COMPLETED',
   app.demo_past(1,10,0),15,app.demo_past(1,10,0),app.demo_past(1,10,0) + interval '14 minutes',true,now());

INSERT INTO visit_records
  (id, "taskId", "householdId", "elderId", "staffProfileId",
   "spiritLevel", "dietLevel", "sleepLevel", "activityLevel", "completedItems", "observationText",
   "submittedAt", "reviewedById", "reviewedAt", "isDemo", "updatedAt")
VALUES
  ('vr_w_phone','tsk_w_phone','hh_wang','eld_wangm','stf_li',
   'NORMAL','NORMAL','NORMAL','UNKNOWN','{电话问候,确认近况}',
   '（示例）电话里声音挺有力，说这两天天气好，下楼多走了几趟。',
   app.demo_past(1,10,0) + interval '20 minutes','usr_sup',app.demo_past(1,10,0) + interval '2 hours',true,now());

-- (3) 本周还没到的上门探访 —— 家庭端「接下来的安排」看的是这条
INSERT INTO service_tasks
  (id, "taskNo", "householdId", "elderId", "staffProfileId", "serviceType", status,
   "scheduledStart", "estimatedMinutes", "addressLine", "taskItems", "attentionSnapshot", "isDemo", "updatedAt")
VALUES
  ('tsk_w_next','TSK-' || to_char(app.demo_future(3,14,0),'YYYYMMDD') || '-0041','hh_wang','eld_wangm','stf_li','HOME_VISIT','ASSIGNED',
   app.demo_future(3,14,0),60,'（示例）岳麓区银盆岭街道××小区 3 栋 2 单元 602',
   '{陪伴聊天,生活情况观察,协助代购生活用品}',
   '（示例）耳背，说话放慢面对着说。上次提到厨房燃气软管老化，本次跟进物业是否已处理。',true,now());

-- (4) 一条还没派单的任务 —— 运营首页「待派单」待办就是它
INSERT INTO service_tasks
  (id, "taskNo", "householdId", "elderId", "serviceType", status, "scheduledStart", "estimatedMinutes", "isDemo", "updatedAt")
VALUES
  ('tsk_w_unassigned','TSK-' || to_char(app.demo_future(4,10,0),'YYYYMMDD') || '-0045','hh_wang','eld_wangm','PHONE_CARE','PENDING_ASSIGN',
   app.demo_future(4,10,0),15,true,now());

-- ---------------------------------------------------------------------------
-- 异常事件：联系不上长辈（已闭环）
-- 事件必须有完整时间线；关闭必须填处理结果。
-- ---------------------------------------------------------------------------
INSERT INTO incidents
  (id, "incidentNo", "householdId", "elderId", "taskId", type, severity, status, description,
   "occurredAt", "needsImmediateFamilyContact", "reportedById", "ownerId", "acknowledgedAt", "closedAt", resolution, "isDemo", "updatedAt")
VALUES
  ('inc_w1','INC-' || to_char(app.demo_ago(31),'YYYYMMDD') || '-0007','hh_wang','eld_wangm',NULL,
   'CANNOT_REACH_ELDER','HIGH','CLOSED',
   '（示例）13:40 到达后按门铃与敲门均无回应，拨打长辈手机两次无人接听。已在门口等待，未擅自进入。',
   app.demo_ago(31),true,'usr_li','usr_sup',app.demo_ago(31) + interval '4 minutes',
   app.demo_ago(31) + interval '55 minutes',
   '（示例）长辈临时去了隔壁邻居家，手机静音没听到。已回到家中，状态正常，服务照常进行。已与家属确认，并提醒长辈外出时带上手机。',
   true,now());

INSERT INTO incident_events (id, "incidentId", "actorId", "actorName", action, note, "occurredAt")
VALUES
  ('ie_1','inc_w1','usr_li','示例·李晨','REPORTED','（示例）13:40 按门铃与敲门无回应，电话两次未接。已在门口等待。',app.demo_ago(31)),
  ('ie_2','inc_w1','usr_sup','示例·服务督导 陈静','ACKNOWLEDGED','（示例）13:44 已接手，开始联系家属。',app.demo_ago(31) + interval '4 minutes'),
  ('ie_3','inc_w1','usr_sup','示例·服务督导 陈静','FAMILY_NOTIFIED','（示例）13:45 已联系主要联络人王女士说明情况。',app.demo_ago(31) + interval '5 minutes'),
  ('ie_4','inc_w1','usr_sup','示例·服务督导 陈静','UPDATED','（示例）14:10 王女士回电，确认长辈临时去了邻居家。',app.demo_ago(31) + interval '30 minutes'),
  ('ie_5','inc_w1','usr_li','示例·李晨','UPDATED','（示例）14:20 长辈回到家门口，状态正常，服务照常进行。',app.demo_ago(31) + interval '40 minutes'),
  ('ie_6','inc_w1','usr_sup','示例·服务督导 陈静','CLOSED','（示例）已与家属确认处理结果，事件关闭。',app.demo_ago(31) + interval '55 minutes');

-- ---------------------------------------------------------------------------
-- 安心报告
--   rpt_w_pub  = 上周的，已发布，家庭端能读到（王女士有 ASSURANCE_REPORT 授权）
--   rpt_w_draft= 本周的，待审核，家庭端【看不到】
-- 报告的统计数字全部由原始记录得出，不允许人工修改。
-- ---------------------------------------------------------------------------
INSERT INTO assurance_reports
  (id, "reportNo", "householdId", "elderId", "periodStart", "periodEnd", status, generation, title,
   "visitCount", "phoneCareCount", "spiritSummary", "dietSummary", "sleepSummary", "activitySummary",
   "lifeSummary", "attentionSummary", "familyTip", "aiGenerated", "reviewedById", "reviewedAt",
   "publishedAt", "firstReadAt", "familyRating", "familyComment", "isDemo", "updatedAt")
VALUES
  ('rpt_w_pub','RPT-' || to_char(app.demo_ago(10),'IYYY') || 'W' || to_char(app.demo_ago(10),'IW') || '-0018',
   'hh_wang','eld_wangm',app.demo_ago(14),app.demo_ago(7),'PUBLISHED','RULE_BASED_DRAFT',
   '王秀兰 上周安心报告',1,2,
   '（示例）两次接触时精神都不错，愿意主动聊天。',
   '（示例）本人说胃口一般，中午吃得不多。',
   '（示例）本人说入睡比较晚，半夜会醒一次。',
   '（示例）每天在小区里走动，下楼扶着扶手，速度较慢。',
   '（示例）家里整洁，日常起居能自己安排。上门时帮忙收紧了阳台的晾衣绳。',
   '（示例）长辈自己提到膝盖上下楼会疼。下楼台阶处光线偏暗，建议加一个夜灯。',
   '（示例）如果您本周有空，可以电话里问问她膝盖的情况 —— 她一般不会主动说。',
   false,'usr_sup',app.demo_ago(8),app.demo_ago(7),app.demo_ago(6),5,'（示例）写得很细，看到这些就放心多了。',true,now()),
  ('rpt_w_draft','RPT-' || to_char(now(),'IYYY') || 'W' || to_char(now(),'IW') || '-0026',
   'hh_wang','eld_wangm',app.demo_ts(0,0,0),app.demo_ts(6,23,59),'PENDING_REVIEW','RULE_BASED_DRAFT',
   '王秀兰 本周安心报告',1,1,
   '（示例）精神不错，主动讲了以前在纺织厂上班的事。',
   '（示例）本人说这两天胃口一般，中午只吃了半碗饭。',
   '（示例）本人说昨晚约凌晨一点才入睡。',
   '（示例）在客厅和楼道走动，下楼时扶着扶手。',
   '（示例）帮忙收紧了阳台晾衣绳。',
   '（示例）厨房燃气软管有老化痕迹，已提醒家属找物业检查。长辈自述膝盖上下楼会疼。',
   NULL,false,NULL,NULL,NULL,NULL,NULL,NULL,true,now());

INSERT INTO assurance_report_sources (id, "reportId", "visitRecordId", "taskId") VALUES
  ('ars_1','rpt_w_pub',NULL,NULL),
  ('ars_2','rpt_w_draft','vr_w_visit','tsk_w_visit'),
  ('ars_3','rpt_w_draft','vr_w_phone','tsk_w_phone');

-- ---------------------------------------------------------------------------
-- 家庭时间线（每条都带 requiredPermission，家庭端按授权过滤）
-- 其中一条 internalOnly = true，家庭端永远看不到 —— 用于验证内部记录不外泄。
-- ---------------------------------------------------------------------------
INSERT INTO timeline_events
  (id, "householdId", "elderId", "occurredAt", title, detail, "refType", "refId", "requiredPermission", "internalOnly", "isDemo")
VALUES
  ('tl_w1','hh_wang','eld_wangm',app.demo_ago(7),'上周安心报告已发布','可以在「安心报告」里查看。','report','rpt_w_pub','ASSURANCE_REPORT',false,true),
  ('tl_w2','hh_wang','eld_wangm',app.demo_past(3,14,0) + interval '68 minutes','本周上门探访已完成','李晨完成了本次上门陪伴与生活协助。','task','tsk_w_visit','LIFE_RECORD',false,true),
  ('tl_w3','hh_wang','eld_wangm',app.demo_past(1,10,0),'电话关怀已完成','和长辈聊了约 14 分钟。','task','tsk_w_phone','LIFE_RECORD',false,true),
  ('tl_w4','hh_wang','eld_wangm',app.demo_ago(31),'一次异常已处理完成','当时联系不上长辈，已确认安全。','incident','inc_w1','INCIDENT_ALERT',false,true),
  ('tl_w5','hh_wang','eld_wangm',app.demo_future(3,14,0),'下次上门安排','李晨将于周四下午上门。','task','tsk_w_next','SERVICE_SCHEDULE',false,true),
  ('tl_w6','hh_wang','eld_wangm',app.demo_ago(5),'内部质控抽查记录','（示例）督导抽查了本周记录质量，家庭端不可见。','internal',NULL,'LIFE_RECORD',true,true);

-- 站内通知
INSERT INTO notifications (id, "userId", level, channel, title, body, "linkUrl", "refType", "refId", "readAt", "dispatchedAt", "isDemo")
VALUES
  ('ntf_1','usr_wangd','NORMAL','IN_APP','王秀兰的安心报告已经可以查看','上周的《王秀兰 上周安心报告》已发布。','/family/reports/rpt_w_pub','report','rpt_w_pub',app.demo_ago(6),app.demo_ago(7),true),
  ('ntf_2','usr_wangs','IMPORTANT','IN_APP','王秀兰下次服务：下周四下午','李晨将上门进行上门安心探访。','/family/service','task','tsk_w_next',NULL,app.demo_ago(1),true),
  ('ntf_3','usr_sup','IMPORTANT','IN_APP','有 1 份安心报告待审核','王家本周报告已生成草稿，等待人工确认。','/admin/service/reports','report','rpt_w_draft',NULL,app.demo_ago(0.2),true);

-- 家庭反馈 + 一条待处理的改期申请
INSERT INTO feedback_cases
  (id, "caseNo", "householdId", "submittedById", "assigneeId", category, status, "isComplaint", subject, content, resolution, "resolvedAt", "isDemo", "updatedAt")
VALUES
  ('fb_1','CASE-' || to_char(app.demo_ago(20),'YYYYMMDD') || '-0003','hh_wang','usr_wangd','usr_cs','SERVICE_CONTENT','RESOLVED',false,
   '（示例）希望每次上门能多聊一会儿',
   '（示例）我妈说李晨来得挺准时，就是觉得时间有点短。能不能稍微多待一会儿？',
   '（示例）已与家庭电话沟通：安心版每次约 60 分钟。已在家庭执行计划里把偏好时段调到下午长辈精神更好的时候，并备注可视情况适度延长。',
   app.demo_ago(18),true,now()),
  ('fb_2','CASE-' || to_char(app.demo_ago(2),'YYYYMMDD') || '-0011','hh_wang','usr_wangs',NULL,'CONSULTATION','NEW',false,
   '（示例）想了解陪诊协助怎么收费',
   '（示例）下个月我妈要去省人民医院复查，想问陪诊怎么安排、多少钱。',
   NULL,NULL,true,now());

INSERT INTO service_change_requests
  (id, "requestNo", "taskId", "requestedById", type, status, "preferredAt", "serviceType", reason, "isDemo", "updatedAt")
VALUES
  ('req_1','REQ-' || to_char(app.demo_ago(1),'YYYYMMDD') || '-0005','tsk_w_next','usr_wangd','RESCHEDULE','SUBMITTED',
   app.demo_future(3,14,0) + interval '1 day', NULL,
   '（示例）那天我回长沙，想自己陪我妈，能不能往后挪一天？',true,now()),
  ('req_2','REQ-' || to_char(app.demo_ago(1),'YYYYMMDD') || '-0006',NULL,'usr_wangd','EXTRA_SERVICE','SUBMITTED',
   app.demo_future(2,9,0) + interval '14 days','MEDICAL_ESCORT',
   '（示例）我妈下个月要去省人民医院复查，希望有人陪同挂号与取药。',true,now());

-- ===========================================================================
-- 11. 家庭二：刘家（用于验证家庭之间的数据隔离）
-- ===========================================================================
INSERT INTO households
  (id, "householdCode", name, "cityId", "districtId", "addressLine", status,
   "consultantId", "primarySpecialistId", "serviceNotes", "joinedAt", "isDemo", "updatedAt")
VALUES
  ('hh_liu','CS-000024','刘家','city_cs','dist_kaifu','（示例）开福区四方坪街道××小区 8 栋 1 单元','ACTIVE_MEMBER',
   'usr_cons','stf_zhou','（示例）长辈使用助行器，上门时留意门口有没有障碍物。',app.demo_ago(60),true,now());

INSERT INTO elders
  (id, "householdId", name, gender, birthday, phone, address, "livingStatus", "mobilityStatus",
   "dailyRoutine", "activityNotes", "dietNotes", "familyRelations", "attentionNotes", "isDemo", "updatedAt")
VALUES
  ('eld_liuf','hh_liu','刘建国','MALE','1943-09-30','13900000024',
   '（示例）开福区四方坪街道××小区 8 栋 1 单元 301','WITH_SPOUSE','NEEDS_AID',
   '（示例）上午在家听广播，下午在小区花园坐着。','（示例）使用助行器，室内活动为主。',
   '（示例）爱吃软烂的菜，牙口不太好。','（示例）儿子刘先生（付款人、主要联络人）。',
   '（示例）助行器胶垫磨损要留意。走廊有一处门槛，进出要提醒。',true,now());

INSERT INTO family_members (id, "userId", "householdId", "elderId", relationship, "isPayer", "isPrimaryContact", "isEmergencyContact", "isDemo", "updatedAt")
VALUES ('fm_lius','usr_lius','hh_liu','eld_liuf','SON',true,true,true,true,now());
UPDATE households SET "primaryContactId" = 'fm_lius' WHERE id = 'hh_liu';

INSERT INTO consents (id, "elderId", "grantorId", "granteeId", "permissionType", "grantedAt", status, version, basis, "isDemo", "updatedAt")
VALUES
  ('cst_l_report','eld_liuf','usr_lius','usr_lius','ASSURANCE_REPORT',app.demo_ago(58),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_l_life','eld_liuf','usr_lius','usr_lius','LIFE_RECORD',app.demo_ago(58),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_l_sched','eld_liuf','usr_lius','usr_lius','SERVICE_SCHEDULE',app.demo_ago(58),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now()),
  ('cst_l_inc','eld_liuf','usr_lius','usr_lius','INCIDENT_ALERT',app.demo_ago(58),'ACTIVE',1,'ELDER_VERBAL_WITNESSED',true,now());

INSERT INTO subscriptions
  (id, "householdId", "planId", status, "startDate", "currentPeriodStart", "currentPeriodEnd", "monthlyPrice", "autoRenew", "usedVisits", "usedPhoneCare", "usedReports", "isDemo", "updatedAt")
VALUES ('sub_liu','hh_liu','plan_stew','ACTIVE',app.demo_ago(58),app.demo_ago(5),app.demo_ago(-25),159900,true,2,3,1,true,now());

INSERT INTO orders (id, "orderNo", "householdId", "subscriptionId", type, status, amount, currency, description, "paidAt", "invoiceStatus", "isDemo", "updatedAt")
VALUES ('ord_l1','ORD-' || to_char(app.demo_ago(5),'YYYYMMDD') || '-0002','hh_liu','sub_liu','RENEWAL','PAID',159900,'CNY','管家版 续费 1 个月',app.demo_ago(5),'NOT_REQUESTED',true,now());

INSERT INTO service_tasks
  (id, "taskNo", "householdId", "elderId", "staffProfileId", "serviceType", status,
   "scheduledStart", "estimatedMinutes", "startedAt", "endedAt", "isDemo", "updatedAt")
VALUES
  ('tsk_l_visit','TSK-' || to_char(app.demo_past(1,9,30),'YYYYMMDD') || '-0044','hh_liu','eld_liuf','stf_zhou','HOME_VISIT','COMPLETED',
   app.demo_past(1,9,30),60,app.demo_past(1,9,30),app.demo_past(1,9,30) + interval '62 minutes',true,now());

INSERT INTO visit_records
  (id, "taskId", "householdId", "elderId", "staffProfileId",
   "spiritLevel", "dietLevel", "dietNote", "sleepLevel", "activityLevel", "activityNote",
   "completedItems", "observationText", "submittedAt", "reviewedById", "reviewedAt", "isDemo", "updatedAt")
VALUES
  ('vr_l_visit','tsk_l_visit','hh_liu','eld_liuf','stf_zhou',
   'NORMAL','FAIR','（示例）本人说这两天胃口一般。','NORMAL','FAIR','（示例）使用助行器在客厅走动，室内活动为主。',
   '{陪伴聊天,协助整理居家环境}',
   '（示例）刘叔叔今天精神不错，主动讲了很多以前的事。助行器胶垫有磨损，已告知家属需要更换，并记录在待跟进事项。',
   app.demo_past(1,9,30) + interval '70 minutes','usr_sup',app.demo_past(1,9,30) + interval '3 hours',true,now());

INSERT INTO assurance_reports
  (id, "reportNo", "householdId", "elderId", "periodStart", "periodEnd", status, generation, title,
   "visitCount", "phoneCareCount", "spiritSummary", "lifeSummary", "attentionSummary",
   "reviewedById", "reviewedAt", "publishedAt", "isDemo", "updatedAt")
VALUES
  ('rpt_l_pub','RPT-' || to_char(app.demo_ago(8),'IYYY') || 'W' || to_char(app.demo_ago(8),'IW') || '-0024',
   'hh_liu','eld_liuf',app.demo_ago(14),app.demo_ago(7),'PUBLISHED','RULE_BASED_DRAFT','刘建国 上周安心报告',
   2,3,'（示例）精神状态稳定，愿意聊天。','（示例）室内活动为主，起居有老伴照应。',
   '（示例）助行器胶垫磨损，已提示家属更换。',
   'usr_sup',app.demo_ago(9),app.demo_ago(8),true,now());

INSERT INTO timeline_events (id, "householdId", "elderId", "occurredAt", title, "refType", "refId", "requiredPermission", "internalOnly", "isDemo")
VALUES
  ('tl_l1','hh_liu','eld_liuf',app.demo_ago(8),'上周安心报告已发布','report','rpt_l_pub','ASSURANCE_REPORT',false,true),
  ('tl_l2','hh_liu','eld_liuf',app.demo_past(1,9,30) + interval '62 minutes','本周上门探访已完成','task','tsk_l_visit','LIFE_RECORD',false,true);

-- ===========================================================================
-- 12. 家庭三：潜在家庭（还没成为会员，用于看「潜在家庭」列表）
-- ===========================================================================
INSERT INTO households
  (id, "householdCode", name, "cityId", "districtId", status, "consultantId", "internalNotes", "isDemo", "updatedAt")
VALUES
  ('hh_chen','CS-000031','陈家','city_cs','dist_tianxin','PENDING_ASSESSMENT','usr_cons',
   '（示例）女儿来电咨询，已约本周五上门做家庭安心评估。长辈本人还在犹豫，评估时注意不要给压力。',true,now());

INSERT INTO elders (id, "householdId", name, gender, birthday, "livingStatus", "mobilityStatus", "isDemo", "updatedAt")
VALUES ('eld_chen','hh_chen','陈桂芳','FEMALE','1951-02-18','WITH_SPOUSE','INDEPENDENT',true,now());

INSERT INTO service_tasks (id, "taskNo", "householdId", "elderId", "staffProfileId", "serviceType", status, "scheduledStart", "estimatedMinutes", "isDemo", "updatedAt")
VALUES ('tsk_c_assess','TSK-' || to_char(app.demo_future(4,15,0),'YYYYMMDD') || '-0048','hh_chen','eld_chen','stf_cons','ASSESSMENT','ASSIGNED',app.demo_future(4,15,0),90,true,now());

-- ===========================================================================
-- 13. 专员变更记录 + 审计日志
-- ===========================================================================
INSERT INTO specialist_change_logs (id, "householdId", "fromStaffProfileId", "toStaffProfileId", reason, "changedByName", "familyNotifiedAt")
VALUES ('scl_1','hh_wang',NULL,'stf_li','（示例）首次分配固定安心专员。','示例·运营 张敏',app.demo_ago(118));

INSERT INTO audit_logs (id, "userId", "actorName", "actorRole", action, resource, "resourceId", "permissionNote", "ipAddress")
VALUES
  ('aud_1','usr_ops','示例·运营 张敏','OPERATIONS','elder.sensitive.read','elder','eld_wangm','（示例）因家属询问用药情况而查看，属服务必要范围。','203.0.113.10'),
  ('aud_2','usr_sup','示例·服务督导 陈静','SERVICE_SUPERVISOR','visitRecord.review','visit_record','vr_w_visit','（示例）审核原始服务记录。','203.0.113.11'),
  ('aud_3','usr_sup','示例·服务督导 陈静','SERVICE_SUPERVISOR','report.publish','assurance_report','rpt_w_pub','（示例）人工确认后发布给家庭。','203.0.113.11'),
  ('aud_4','usr_wangd','示例·王女士','FAMILY_MEMBER','consent.revoke','consent','cst_s_life','（示例）家属自行撤回了给王先生的生活记录授权。','203.0.113.55');

-- ---------------------------------------------------------------------------
-- 清理辅助函数（保留 demo_pwd 之外的也没必要留在库里）
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS app.demo_pwd();
DROP FUNCTION IF EXISTS app.demo_ago(numeric);
DROP FUNCTION IF EXISTS app.demo_past(int, int, int);
DROP FUNCTION IF EXISTS app.demo_future(int, int, int);
DROP FUNCTION IF EXISTS app.demo_ts(int, int, int);

COMMIT;
