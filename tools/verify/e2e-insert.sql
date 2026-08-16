SET search_path TO check_model;
\set ON_ERROR_STOP on
BEGIN;

-- ===================== 1. 基础配置 =====================
INSERT INTO cities (id,name,province) VALUES ('c_cs','长沙','湖南');
INSERT INTO districts (id,"cityId",name) VALUES ('d_yh','c_cs','雨花区'),('d_kf','c_cs','开福区');
INSERT INTO service_plans (id,code,name,tier,"monthlyPrice","visitsPerMonth","phoneCarePerMonth","reportsPerMonth","includedServices","updatedAt")
VALUES ('p_as','ASSURANCE','安心版','ASSURANCE',79900,4,8,4,'{HOME_VISIT,PHONE_CARE}',now());

-- 服务目录：只有 familyRequestable=true 的才允许家庭自助申请
INSERT INTO service_catalog_items (id,"serviceType","displayName","defaultMinutes","addOnPrice","familyRequestable","updatedAt") VALUES
 ('sc1','HOME_VISIT','上门安心探访',60,NULL,false,now()),
 ('sc2','PHONE_CARE','电话关怀',15,NULL,false,now()),
 ('sc3','MEDICAL_ESCORT','陪诊协助',180,29900,true,now()),
 ('sc4','DAILY_ASSISTANCE','生活代办',60,9900,true,now());

INSERT INTO notification_templates (id,event,name,"titleTemplate","availableVars","enabledChannels","requiredPermission","updatedAt") VALUES
 ('nt1','REPORT_PUBLISHED','安心报告已发布','{{elderName}}的安心报告已经可以查看','{"{{elderName}}"}','{IN_APP}','ASSURANCE_REPORT',now()),
 ('nt2','INCIDENT_URGENT','紧急异常通知','{{elderName}}发生{{incidentType}}','{"{{elderName}}"}','{IN_APP}','INCIDENT_ALERT',now());

-- ===================== 2. 帐号 =====================
INSERT INTO users (id,name,phone,"passwordHash",role,"cityId","updatedAt") VALUES
 ('u_sup','服务督导','13800000003','$2a$hash','SERVICE_SUPERVISOR','c_cs',now()),
 ('u_li','李晨','13800000011','$2a$hash','CARE_SPECIALIST','c_cs',now()),
 ('u_zhou','周敏','13800000012','$2a$hash','CARE_SPECIALIST','c_cs',now()),
 ('u_wd','王女士','13800000021','$2a$hash','FAMILY_MEMBER',NULL,now()),
 ('u_ws','王先生','13800000022','$2a$hash','FAMILY_MEMBER',NULL,now()),
 ('u_liu','刘先生','13800000031','$2a$hash','FAMILY_MEMBER',NULL,now());

INSERT INTO staff_profiles (id,"userId","employeeCode","cityId","districtId","serviceStatus","updatedAt") VALUES
 ('sp_li','u_li','AX-0001','c_cs','d_yh','ACTIVE',now()),
 ('sp_zhou','u_zhou','AX-0002','c_cs','d_kf','ACTIVE',now());

-- ===================== 3. 两个家庭（用于验证家庭之间隔离） =====================
INSERT INTO households (id,"householdCode",name,"cityId","districtId",status,"primarySpecialistId","updatedAt") VALUES
 ('h_wang','CS-000001','王家','c_cs','d_yh','ACTIVE_MEMBER','sp_li',now()),
 ('h_liu','CS-000002','刘家','c_cs','d_kf','ACTIVE_MEMBER','sp_zhou',now());

INSERT INTO elders (id,"householdId",name,gender,"updatedAt") VALUES
 ('e_wm','h_wang','王秀兰','FEMALE',now()),
 ('e_lf','h_liu','刘建国','MALE',now());

-- 健康敏感信息：单独一张表
INSERT INTO elder_sensitive_info (id,"elderId","chronicConditions","bpSystolicMax","updatedAt")
VALUES ('esi_wm','e_wm','高血压（家庭自述）',140,now());

INSERT INTO family_members (id,"userId","householdId","elderId",relationship,"isPayer","isPrimaryContact","updatedAt") VALUES
 ('fm_wd','u_wd','h_wang','e_wm','DAUGHTER',true,true,now()),
 ('fm_ws','u_ws','h_wang','e_wm','SON',false,false,now()),
 ('fm_liu','u_liu','h_liu','e_lf','SON',true,true,now());

-- ===================== 4. 授权（付款权 ≠ 数据查看权） =====================
-- 王女士是付款人，但刻意不授予 SENSITIVE_HEALTH
INSERT INTO consents (id,"elderId","grantorId","granteeId","permissionType",status,"updatedAt") VALUES
 ('cs1','e_wm','u_wd','u_wd','ASSURANCE_REPORT','ACTIVE',now()),
 ('cs2','e_wm','u_wd','u_wd','LIFE_RECORD','ACTIVE',now()),
 ('cs3','e_wm','u_wd','u_wd','SERVICE_SCHEDULE','ACTIVE',now()),
 ('cs4','e_wm','u_wd','u_wd','INCIDENT_ALERT','ACTIVE',now()),
 ('cs5','e_wm','u_wd','u_wd','PHOTO','ACTIVE',now()),
 -- 王先生只有服务安排 + 异常通知
 ('cs6','e_wm','u_wd','u_ws','SERVICE_SCHEDULE','ACTIVE',now()),
 ('cs7','e_wm','u_wd','u_ws','INCIDENT_ALERT','ACTIVE',now()),
 -- 一条已撤回的授权：撤回后 status=REVOKED，记录不删除
 ('cs8','e_wm','u_wd','u_ws','LIFE_RECORD','REVOKED',now()),
 -- 刘家
 ('cs9','e_lf','u_liu','u_liu','ASSURANCE_REPORT','ACTIVE',now());

-- ===================== 5. 订阅 / 订单 / 发票 =====================
INSERT INTO subscriptions (id,"householdId","planId",status,"currentPeriodEnd","monthlyPrice","updatedAt")
VALUES ('sub_w','h_wang','p_as','ACTIVE',now()+interval '10 days',79900,now());
INSERT INTO orders (id,"orderNo","householdId","subscriptionId",type,status,amount,"paidAt","invoiceStatus","invoiceType","invoiceTitle","invoiceNo","invoicedAt","updatedAt")
VALUES ('o1','ORD-20260101-0001','h_wang','sub_w','NEW_SUBSCRIPTION','PAID',239700,now(),'ISSUED','PERSONAL_ELECTRONIC','王秀兰','DEMO-00000001',now(),now());
INSERT INTO orders (id,"orderNo","householdId","subscriptionId",type,status,amount,"paidAt","invoiceStatus","invoiceType","invoiceTitle","invoiceTaxNo","updatedAt")
VALUES ('o2','ORD-20260201-0001','h_wang','sub_w','RENEWAL','PAID',79900,now(),'REQUESTED','COMPANY_ELECTRONIC','长沙示例科技有限公司','91430100DEMO0000XX',now());

-- ===================== 6. 任务 → 记录 → 数值 → 报告 =====================
INSERT INTO service_tasks (id,"taskNo","householdId","elderId","staffProfileId","serviceType",status,"scheduledStart","estimatedMinutes","startedAt","endedAt","updatedAt")
VALUES ('t1','TSK-20260210-0001','h_wang','e_wm','sp_li','HOME_VISIT','COMPLETED',now()-interval '2 days',60,now()-interval '2 days',now()-interval '2 days'+interval '65 min',now());
INSERT INTO service_tasks (id,"taskNo","householdId","elderId","staffProfileId","serviceType",status,"scheduledStart","updatedAt")
VALUES ('t2','TSK-20260215-0001','h_wang','e_wm','sp_li','PHONE_CARE','ASSIGNED',now()+interval '1 day',now());
INSERT INTO service_tasks (id,"taskNo","householdId","elderId","staffProfileId","serviceType",status,"scheduledStart","updatedAt")
VALUES ('t3','TSK-20260211-0002','h_liu','e_lf','sp_zhou','HOME_VISIT','COMPLETED',now()-interval '1 day',now());

INSERT INTO visit_records (id,"taskId","householdId","elderId","staffProfileId","spiritLevel","observationText","photoKeys","submittedAt","reviewedById","reviewedAt","updatedAt")
VALUES ('vr1','t1','h_wang','e_wm','sp_li','NORMAL','（示例）今天精神不错，主动聊了很多。','{private/visits/vr1/1.jpg}',now(),'u_sup',now(),now());
INSERT INTO visit_records (id,"taskId","householdId","elderId","staffProfileId","spiritLevel","submittedAt","updatedAt")
VALUES ('vr2','t3','h_liu','e_lf','sp_zhou','NORMAL',now(),now());

INSERT INTO health_readings (id,"elderId","visitRecordId",type,source,"valuePrimary","valueSecondary",unit,"outsideFamilyRange")
VALUES ('hr1','e_wm','vr1','BLOOD_PRESSURE','ELDER_SELF_MEASURED',152,88,'mmHg',true);

INSERT INTO assurance_reports (id,"reportNo","householdId","elderId","periodStart","periodEnd",status,generation,title,"reviewedById","publishedAt","updatedAt")
VALUES ('rp1','RPT-2026W07-0001','h_wang','e_wm',now()-interval '7 days',now(),'PUBLISHED','RULE_BASED_DRAFT','王秀兰 本周安心报告','u_sup',now(),now());
INSERT INTO assurance_report_sources (id,"reportId","visitRecordId","taskId") VALUES ('rs1','rp1','vr1','t1');
-- 刘家也有一份报告，用于验证王女士看不到
INSERT INTO assurance_reports (id,"reportNo","householdId","elderId","periodStart","periodEnd",status,title,"publishedAt","updatedAt")
VALUES ('rp2','RPT-2026W07-0002','h_liu','e_lf',now()-interval '7 days',now(),'PUBLISHED','刘建国 本周安心报告',now(),now());

-- ===================== 7. 异常事件 / 时间线 / 通知 / 日志 =====================
INSERT INTO incidents (id,"incidentNo","householdId","elderId","taskId",type,severity,status,description,"reportedById","updatedAt")
VALUES ('in1','INC-20260210-0001','h_wang','e_wm','t1','CANNOT_REACH_ELDER','HIGH','CLOSED','（示例）按门铃无回应，已按流程处理。','u_li',now());
INSERT INTO timeline_events (id,"householdId","elderId",title,"requiredPermission") VALUES
 ('tl1','h_wang','e_wm','本周安心报告已发布','ASSURANCE_REPORT'),
 ('tl2','h_wang','e_wm','服务已完成','LIFE_RECORD'),
 ('tl3','h_wang','e_wm','内部质控记录','LIFE_RECORD');
UPDATE timeline_events SET "internalOnly"=true WHERE id='tl3';
INSERT INTO notifications (id,"userId",title,"refType","refId") VALUES ('nf1','u_wd','本周安心报告已经可以查看','report','rp1');
INSERT INTO audit_logs (id,"userId","actorName","actorRole",action,resource,"resourceId","permissionNote")
VALUES ('al1','u_sup','服务督导','SERVICE_SUPERVISOR','elder.sensitive.read','elder','e_wm','查看健康敏感信息（服务必要）');

COMMIT;
