CREATE SCHEMA IF NOT EXISTS app;
SET search_path TO app;

CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OPERATIONS', 'SERVICE_SUPERVISOR', 'AREA_MANAGER', 'CUSTOMER_SERVICE', 'FINANCE', 'HR', 'CITY_LEAD', 'FAMILY_CONSULTANT', 'SENIOR_CARE_SPECIALIST', 'CARE_SPECIALIST', 'FAMILY_MEMBER');
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "HouseholdStatus" AS ENUM ('LEAD', 'PENDING_ASSESSMENT', 'TRIAL', 'ACTIVE_MEMBER', 'RENEWAL_DUE', 'PAUSED', 'TERMINATED');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNDISCLOSED');
CREATE TYPE "LivingStatus" AS ENUM ('ALONE', 'WITH_SPOUSE', 'WITH_CHILDREN', 'WITH_CAREGIVER', 'OTHER');
CREATE TYPE "MobilityStatus" AS ENUM ('INDEPENDENT', 'SLOW_BUT_INDEPENDENT', 'NEEDS_AID', 'NEEDS_ASSISTANCE', 'MOSTLY_BEDBOUND', 'UNKNOWN');
CREATE TYPE "RelationshipType" AS ENUM ('SON', 'DAUGHTER', 'SPOUSE', 'DAUGHTER_IN_LAW', 'SON_IN_LAW', 'GRANDCHILD', 'SIBLING', 'RELATIVE', 'FRIEND', 'OTHER');
CREATE TYPE "PermissionType" AS ENUM ('ASSURANCE_REPORT', 'LIFE_RECORD', 'PHOTO', 'INCIDENT_ALERT', 'SENSITIVE_HEALTH', 'SERVICE_SCHEDULE', 'CONTACT_INFO');
CREATE TYPE "ConsentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE "ConsentBasis" AS ENUM ('ELDER_SELF_SIGNED', 'ELDER_VERBAL_WITNESSED', 'LEGAL_GUARDIAN', 'SERVICE_NECESSITY');
CREATE TYPE "StaffLevel" AS ENUM ('TRAINEE', 'JUNIOR', 'INTERMEDIATE', 'SENIOR', 'SUPERVISOR');
CREATE TYPE "EmploymentStatus" AS ENUM ('CANDIDATE', 'ONBOARDED', 'RESIGNED');
CREATE TYPE "ServiceStatus" AS ENUM ('NOT_STARTED', 'IN_TRAINING', 'PENDING_ASSESSMENT', 'PASSED', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "EducationLevel" AS ENUM ('SECONDARY_VOCATIONAL', 'JUNIOR_COLLEGE', 'BACHELOR', 'MASTER', 'OTHER');
CREATE TYPE "TrainingType" AS ENUM ('ONBOARDING', 'SERVICE_PHILOSOPHY', 'ELDER_COMMUNICATION', 'SERVICE_PROCESS', 'SAFETY', 'PRIVACY', 'INCIDENT_HANDLING', 'PRACTICAL_ASSESSMENT', 'OTHER');
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PENDING_EXAM', 'PASSED', 'FAILED', 'NEEDS_RETRAIN');
CREATE TYPE "ServiceType" AS ENUM ('HOME_VISIT', 'PHONE_CARE', 'MEDICAL_ESCORT', 'DAILY_ASSISTANCE', 'ASSESSMENT', 'EXTRA_VISIT');
CREATE TYPE "PlanTier" AS ENUM ('CARE', 'ASSURANCE', 'STEWARD');
CREATE TYPE "TaskStatus" AS ENUM ('PENDING_ASSIGN', 'ASSIGNED', 'ACCEPTED', 'READY_TO_DEPART', 'ARRIVED', 'IN_SERVICE', 'PENDING_RECORD', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED', 'RESCHEDULED', 'DECLINED', 'NOT_COMPLETED');
CREATE TYPE "ObservationLevel" AS ENUM ('NORMAL', 'FAIR', 'SELF_REPORTED_ISSUE', 'REDUCED', 'UNKNOWN', 'OTHER');
CREATE TYPE "ReadingSource" AS ENUM ('ELDER_SELF_MEASURED', 'FAMILY_PROVIDED', 'SPECIALIST_ASSISTED', 'MEDICAL_DOCUMENT');
CREATE TYPE "ReadingType" AS ENUM ('BLOOD_PRESSURE', 'BLOOD_GLUCOSE', 'WEIGHT', 'TEMPERATURE', 'HEART_RATE');
CREATE TYPE "IncidentType" AS ENUM ('CANNOT_REACH_ELDER', 'ELDER_FEELS_UNWELL', 'FALL', 'ENVIRONMENT_SAFETY', 'SERVICE_CONFLICT', 'FAMILY_DISPUTE', 'OTHER');
CREATE TYPE "IncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('NEW', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_FOLLOW_UP', 'CLOSED');
CREATE TYPE "ReportStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED');
CREATE TYPE "ReportGeneration" AS ENUM ('RULE_BASED_DRAFT', 'AI_ASSISTED', 'HUMAN_WRITTEN');
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "OrderType" AS ENUM ('NEW_SUBSCRIPTION', 'RENEWAL', 'ADD_ON', 'REFUND');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_REQUESTED', 'REQUESTED', 'ISSUED', 'VOIDED');
CREATE TYPE "InvoiceType" AS ENUM ('PERSONAL_ELECTRONIC', 'COMPANY_ELECTRONIC', 'COMPANY_SPECIAL');
CREATE TYPE "NotificationTemplateEvent" AS ENUM ('SERVICE_COMPLETED', 'REPORT_PUBLISHED', 'NEXT_SERVICE_REMINDER', 'SPECIALIST_CHANGED', 'SCHEDULE_CHANGED', 'MEMBERSHIP_EXPIRING', 'INCIDENT_URGENT', 'CANNOT_REACH_ELDER');
CREATE TYPE "NotificationLevel" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'SMS', 'WECHAT', 'WECOM');
CREATE TYPE "FeedbackCategory" AS ENUM ('SERVICE_ATTITUDE', 'TIMING', 'SERVICE_CONTENT', 'SAFETY', 'PAYMENT', 'CONSULTATION', 'OTHER');
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'AWAITING_FAMILY', 'RESOLVED', 'CLOSED');
CREATE TYPE "ChangeRequestType" AS ENUM ('RESCHEDULE', 'CANCEL', 'EXTRA_SERVICE');
CREATE TYPE "ChangeRequestStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'DECLINED', 'CANCELLED');

CREATE TABLE "cities" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "province" text NOT NULL,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "districts" (
  "id" text NOT NULL,
  "cityId" text NOT NULL,
  "name" text NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "users" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "avatarUrl" text,
  "passwordHash" text NOT NULL,
  "role" "Role" NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE'::"UserStatus",
  "cityId" text,
  "twoFactorEnabled" boolean NOT NULL DEFAULT false,
  "twoFactorSecret" text,
  "lastLoginAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "sessions" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "tokenHash" text NOT NULL,
  "userAgent" text,
  "ipAddress" text,
  "expiresAt" timestamp(3) NOT NULL,
  "revokedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "households" (
  "id" text NOT NULL,
  "householdCode" text NOT NULL,
  "name" text NOT NULL,
  "cityId" text NOT NULL,
  "districtId" text,
  "addressLine" text,
  "status" "HouseholdStatus" NOT NULL DEFAULT 'LEAD'::"HouseholdStatus",
  "primaryContactId" text,
  "consultantId" text,
  "primarySpecialistId" text,
  "backupSpecialistId" text,
  "serviceNotes" text,
  "internalNotes" text,
  "joinedAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "elders" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "name" text NOT NULL,
  "gender" "Gender" NOT NULL DEFAULT 'UNDISCLOSED'::"Gender",
  "birthday" timestamp(3),
  "phone" text,
  "address" text,
  "livingStatus" "LivingStatus",
  "mobilityStatus" "MobilityStatus" NOT NULL DEFAULT 'UNKNOWN'::"MobilityStatus",
  "dailyRoutine" text,
  "activityNotes" text,
  "dietNotes" text,
  "sleepNotes" text,
  "communicationPrefs" text,
  "livingArrangement" text,
  "familyRelations" text,
  "dailyNeeds" text,
  "attentionNotes" text,
  "emergencyArrangement" text,
  "generalNotes" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "elder_sensitive_info" (
  "id" text NOT NULL,
  "elderId" text NOT NULL,
  "chronicConditions" text,
  "medications" text,
  "allergies" text,
  "medicalDocsNotes" text,
  "bpSystolicMax" integer,
  "bpDiastolicMax" integer,
  "glucoseMax" double precision,
  "updatedById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "family_members" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "relationship" "RelationshipType" NOT NULL,
  "isPayer" boolean NOT NULL DEFAULT false,
  "isPrimaryContact" boolean NOT NULL DEFAULT false,
  "isEmergencyContact" boolean NOT NULL DEFAULT false,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "consents" (
  "id" text NOT NULL,
  "elderId" text NOT NULL,
  "grantorId" text NOT NULL,
  "granteeId" text NOT NULL,
  "permissionType" "PermissionType" NOT NULL,
  "scope" text,
  "grantedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" timestamp(3),
  "revokedAt" timestamp(3),
  "status" "ConsentStatus" NOT NULL DEFAULT 'ACTIVE'::"ConsentStatus",
  "version" integer NOT NULL DEFAULT 1,
  "basis" "ConsentBasis" NOT NULL DEFAULT 'ELDER_SELF_SIGNED'::"ConsentBasis",
  "evidenceKey" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "staff_profiles" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "employeeCode" text NOT NULL,
  "staffLevel" "StaffLevel" NOT NULL DEFAULT 'JUNIOR'::"StaffLevel",
  "cityId" text NOT NULL,
  "districtId" text,
  "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'CANDIDATE'::"EmploymentStatus",
  "serviceStatus" "ServiceStatus" NOT NULL DEFAULT 'NOT_STARTED'::"ServiceStatus",
  "bio" text,
  "hiredAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "education_records" (
  "id" text NOT NULL,
  "staffProfileId" text NOT NULL,
  "school" text NOT NULL,
  "major" text NOT NULL,
  "level" "EducationLevel" NOT NULL,
  "graduationYear" integer,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED'::"VerificationStatus",
  "verifiedById" text,
  "verifiedAt" timestamp(3),
  "evidenceKey" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "training_courses" (
  "id" text NOT NULL,
  "title" text NOT NULL,
  "type" "TrainingType" NOT NULL,
  "description" text,
  "contentUrl" text,
  "creditHours" double precision NOT NULL DEFAULT 0,
  "isMandatory" boolean NOT NULL DEFAULT true,
  "validMonths" integer,
  "requiresExam" boolean NOT NULL DEFAULT true,
  "passingScore" integer DEFAULT 60,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "training_records" (
  "id" text NOT NULL,
  "staffProfileId" text NOT NULL,
  "courseId" text NOT NULL,
  "status" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED'::"TrainingStatus",
  "startedAt" timestamp(3),
  "completedAt" timestamp(3),
  "creditHours" double precision,
  "examScore" integer,
  "instructorName" text,
  "remark" text,
  "attachmentKey" text,
  "expiresAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "competencies" (
  "id" text NOT NULL,
  "name" text NOT NULL,
  "code" text NOT NULL,
  "description" text,
  "requiresCredential" boolean NOT NULL DEFAULT false,
  "requiredForServices" "ServiceType"[] NOT NULL DEFAULT '{}',
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "staff_competencies" (
  "id" text NOT NULL,
  "staffProfileId" text NOT NULL,
  "competencyId" text NOT NULL,
  "grantedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "credentialNo" text,
  "credentialStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED'::"VerificationStatus",
  "credentialExpiry" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "staff_availability" (
  "id" text NOT NULL,
  "staffProfileId" text NOT NULL,
  "startAt" timestamp(3) NOT NULL,
  "endAt" timestamp(3) NOT NULL,
  "reason" text,
  "isBlocked" boolean NOT NULL DEFAULT true,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "staff_performance_snapshots" (
  "id" text NOT NULL,
  "staffProfileId" text NOT NULL,
  "periodStart" timestamp(3) NOT NULL,
  "periodEnd" timestamp(3) NOT NULL,
  "onTimeRate" double precision,
  "completionRate" double precision,
  "recordTimelyRate" double precision,
  "reportQualityScore" double precision,
  "familyRatingAvg" double precision,
  "complaintCount" integer NOT NULL DEFAULT 0,
  "incidentCooperation" double precision,
  "trainingCompletion" double precision,
  "retainedHouseholds" integer NOT NULL DEFAULT 0,
  "taskCount" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "service_plans" (
  "id" text NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "tier" "PlanTier" NOT NULL,
  "description" text,
  "monthlyPrice" integer NOT NULL,
  "visitsPerMonth" integer NOT NULL DEFAULT 0,
  "phoneCarePerMonth" integer NOT NULL DEFAULT 0,
  "reportsPerMonth" integer NOT NULL DEFAULT 0,
  "includedServices" "ServiceType"[] NOT NULL DEFAULT '{}',
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "household_service_plans" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "planId" text,
  "visitsPerWeek" double precision NOT NULL DEFAULT 1,
  "phoneCarePerWeek" double precision NOT NULL DEFAULT 2,
  "reportsPerWeek" double precision NOT NULL DEFAULT 1,
  "preferredWeekday" integer,
  "preferredWindow" text,
  "executionNotes" text,
  "startDate" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" timestamp(3),
  "isActive" boolean NOT NULL DEFAULT true,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "household_assessments" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "assessorName" text NOT NULL,
  "assessedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "livingSummary" text,
  "needsSummary" text,
  "riskNotes" text,
  "recommendedTier" "PlanTier",
  "recommendation" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "subscriptions" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "planId" text NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL'::"SubscriptionStatus",
  "startDate" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodStart" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "currentPeriodEnd" timestamp(3) NOT NULL,
  "cancelledAt" timestamp(3),
  "pausedAt" timestamp(3),
  "monthlyPrice" integer NOT NULL,
  "autoRenew" boolean NOT NULL DEFAULT true,
  "usedVisits" integer NOT NULL DEFAULT 0,
  "usedPhoneCare" integer NOT NULL DEFAULT 0,
  "usedReports" integer NOT NULL DEFAULT 0,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "orders" (
  "id" text NOT NULL,
  "orderNo" text NOT NULL,
  "householdId" text NOT NULL,
  "subscriptionId" text,
  "type" "OrderType" NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING'::"OrderStatus",
  "amount" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'CNY',
  "description" text,
  "paidAt" timestamp(3),
  "refundedAt" timestamp(3),
  "refundReason" text,
  "invoiceStatus" "InvoiceStatus" NOT NULL DEFAULT 'NOT_REQUESTED'::"InvoiceStatus",
  "invoiceNo" text,
  "invoiceType" "InvoiceType",
  "invoiceTitle" text,
  "invoiceTaxNo" text,
  "invoicedAt" timestamp(3),
  "invoiceNote" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "service_tasks" (
  "id" text NOT NULL,
  "taskNo" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "staffProfileId" text,
  "serviceType" "ServiceType" NOT NULL,
  "status" "TaskStatus" NOT NULL DEFAULT 'PENDING_ASSIGN'::"TaskStatus",
  "scheduledStart" timestamp(3) NOT NULL,
  "estimatedMinutes" integer NOT NULL DEFAULT 60,
  "addressLine" text,
  "taskItems" text,
  "attentionSnapshot" text,
  "isBackupAssignment" boolean NOT NULL DEFAULT false,
  "reassignReason" text,
  "acceptedAt" timestamp(3),
  "arrivedAt" timestamp(3),
  "startedAt" timestamp(3),
  "endedAt" timestamp(3),
  "checkinLat" double precision,
  "checkinLng" double precision,
  "checkinAccuracy" double precision,
  "cancelledAt" timestamp(3),
  "cancelReason" text,
  "declineReason" text,
  "rescheduledToId" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "deletedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "visit_records" (
  "id" text NOT NULL,
  "taskId" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "staffProfileId" text NOT NULL,
  "spiritLevel" "ObservationLevel" NOT NULL DEFAULT 'UNKNOWN'::"ObservationLevel",
  "spiritNote" text,
  "dietLevel" "ObservationLevel" NOT NULL DEFAULT 'UNKNOWN'::"ObservationLevel",
  "dietNote" text,
  "sleepLevel" "ObservationLevel" NOT NULL DEFAULT 'UNKNOWN'::"ObservationLevel",
  "sleepNote" text,
  "activityLevel" "ObservationLevel" NOT NULL DEFAULT 'UNKNOWN'::"ObservationLevel",
  "activityNote" text,
  "completedItems" text[] NOT NULL DEFAULT '{}',
  "observationText" text,
  "photoKeys" text[] NOT NULL DEFAULT '{}',
  "submittedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" text,
  "reviewedAt" timestamp(3),
  "reviewNote" text,
  "amendmentNote" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "health_readings" (
  "id" text NOT NULL,
  "elderId" text NOT NULL,
  "visitRecordId" text,
  "type" "ReadingType" NOT NULL,
  "source" "ReadingSource" NOT NULL,
  "valuePrimary" double precision NOT NULL,
  "valueSecondary" double precision,
  "unit" text NOT NULL,
  "measuredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" text,
  "outsideFamilyRange" boolean NOT NULL DEFAULT false,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "incidents" (
  "id" text NOT NULL,
  "incidentNo" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "taskId" text,
  "type" "IncidentType" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MEDIUM'::"IncidentSeverity",
  "status" "IncidentStatus" NOT NULL DEFAULT 'NEW'::"IncidentStatus",
  "description" text NOT NULL,
  "occurredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "needsImmediateFamilyContact" boolean NOT NULL DEFAULT false,
  "attachmentKeys" text[] NOT NULL DEFAULT '{}',
  "reportedById" text,
  "ownerId" text,
  "acknowledgedAt" timestamp(3),
  "closedAt" timestamp(3),
  "resolution" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "incident_events" (
  "id" text NOT NULL,
  "incidentId" text NOT NULL,
  "actorId" text,
  "actorName" text NOT NULL,
  "action" text NOT NULL,
  "note" text,
  "occurredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "assurance_reports" (
  "id" text NOT NULL,
  "reportNo" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "periodStart" timestamp(3) NOT NULL,
  "periodEnd" timestamp(3) NOT NULL,
  "status" "ReportStatus" NOT NULL DEFAULT 'DRAFT'::"ReportStatus",
  "generation" "ReportGeneration" NOT NULL DEFAULT 'RULE_BASED_DRAFT'::"ReportGeneration",
  "title" text NOT NULL,
  "visitCount" integer NOT NULL DEFAULT 0,
  "phoneCareCount" integer NOT NULL DEFAULT 0,
  "spiritSummary" text,
  "dietSummary" text,
  "sleepSummary" text,
  "activitySummary" text,
  "lifeSummary" text,
  "attentionSummary" text,
  "familyTip" text,
  "aiGenerated" boolean NOT NULL DEFAULT false,
  "aiModel" text,
  "reviewedById" text,
  "reviewedAt" timestamp(3),
  "reviewNote" text,
  "publishedAt" timestamp(3),
  "rejectReason" text,
  "firstReadAt" timestamp(3),
  "familyRating" integer,
  "familyComment" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "assurance_report_sources" (
  "id" text NOT NULL,
  "reportId" text NOT NULL,
  "visitRecordId" text,
  "taskId" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "timeline_events" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "elderId" text,
  "occurredAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title" text NOT NULL,
  "detail" text,
  "refType" text,
  "refId" text,
  "requiredPermission" "PermissionType" NOT NULL DEFAULT 'SERVICE_SCHEDULE'::"PermissionType",
  "internalOnly" boolean NOT NULL DEFAULT false,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "service_change_requests" (
  "id" text NOT NULL,
  "requestNo" text NOT NULL,
  "taskId" text,
  "requestedById" text NOT NULL,
  "type" "ChangeRequestType" NOT NULL,
  "status" "ChangeRequestStatus" NOT NULL DEFAULT 'SUBMITTED'::"ChangeRequestStatus",
  "preferredAt" timestamp(3),
  "serviceType" "ServiceType",
  "reason" text,
  "handledNote" text,
  "handledAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "feedback_cases" (
  "id" text NOT NULL,
  "caseNo" text NOT NULL,
  "householdId" text NOT NULL,
  "submittedById" text,
  "assigneeId" text,
  "category" "FeedbackCategory" NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW'::"FeedbackStatus",
  "isComplaint" boolean NOT NULL DEFAULT false,
  "subject" text NOT NULL,
  "content" text NOT NULL,
  "resolution" text,
  "resolvedAt" timestamp(3),
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "notifications" (
  "id" text NOT NULL,
  "userId" text NOT NULL,
  "level" "NotificationLevel" NOT NULL DEFAULT 'NORMAL'::"NotificationLevel",
  "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP'::"NotificationChannel",
  "title" text NOT NULL,
  "body" text,
  "linkUrl" text,
  "refType" text,
  "refId" text,
  "readAt" timestamp(3),
  "dispatchedAt" timestamp(3),
  "dispatchError" text,
  "isDemo" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "audit_logs" (
  "id" text NOT NULL,
  "userId" text,
  "actorName" text,
  "actorRole" "Role",
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "resourceId" text,
  "before" jsonb,
  "after" jsonb,
  "ipAddress" text,
  "userAgent" text,
  "permissionNote" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE TABLE "service_catalog_items" (
  "id" text NOT NULL,
  "serviceType" "ServiceType" NOT NULL,
  "displayName" text NOT NULL,
  "description" text,
  "defaultMinutes" integer NOT NULL DEFAULT 60,
  "addOnPrice" integer,
  "familyRequestable" boolean NOT NULL DEFAULT false,
  "requiresCompetency" boolean NOT NULL DEFAULT true,
  "isActive" boolean NOT NULL DEFAULT true,
  "sortOrder" integer NOT NULL DEFAULT 0,
  "updatedById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "notification_templates" (
  "id" text NOT NULL,
  "event" "NotificationTemplateEvent" NOT NULL,
  "name" text NOT NULL,
  "level" "NotificationLevel" NOT NULL DEFAULT 'NORMAL'::"NotificationLevel",
  "titleTemplate" text NOT NULL,
  "bodyTemplate" text,
  "availableVars" text[] NOT NULL DEFAULT '{}',
  "enabledChannels" "NotificationChannel"[] NOT NULL DEFAULT '{}',
  "requiredPermission" "PermissionType",
  "isActive" boolean NOT NULL DEFAULT true,
  "updatedById" text,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  PRIMARY KEY ("id")
);
CREATE TABLE "specialist_change_logs" (
  "id" text NOT NULL,
  "householdId" text NOT NULL,
  "fromStaffProfileId" text,
  "toStaffProfileId" text,
  "reason" text NOT NULL,
  "changedByName" text NOT NULL,
  "familyNotifiedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

ALTER TABLE "cities" ADD CONSTRAINT "cities_name_key" UNIQUE ("name");
ALTER TABLE "districts" ADD CONSTRAINT "districts_cityId_name_key" UNIQUE ("cityId", "name");
ALTER TABLE "users" ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tokenHash_key" UNIQUE ("tokenHash");
ALTER TABLE "households" ADD CONSTRAINT "households_householdCode_key" UNIQUE ("householdCode");
ALTER TABLE "households" ADD CONSTRAINT "households_primaryContactId_key" UNIQUE ("primaryContactId");
ALTER TABLE "elder_sensitive_info" ADD CONSTRAINT "elder_sensitive_info_elderId_key" UNIQUE ("elderId");
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_householdId_key" UNIQUE ("userId", "householdId");
ALTER TABLE "consents" ADD CONSTRAINT "consents_elderId_granteeId_permissionType_version_key" UNIQUE ("elderId", "granteeId", "permissionType", "version");
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_key" UNIQUE ("userId");
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_employeeCode_key" UNIQUE ("employeeCode");
ALTER TABLE "training_courses" ADD CONSTRAINT "training_courses_title_key" UNIQUE ("title");
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_staffProfileId_courseId_key" UNIQUE ("staffProfileId", "courseId");
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_name_key" UNIQUE ("name");
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_code_key" UNIQUE ("code");
ALTER TABLE "staff_competencies" ADD CONSTRAINT "staff_competencies_staffProfileId_competencyId_key" UNIQUE ("staffProfileId", "competencyId");
ALTER TABLE "staff_performance_snapshots" ADD CONSTRAINT "staff_performance_snapshots_staffProfileId_periodStart_periodEnd_key" UNIQUE ("staffProfileId", "periodStart", "periodEnd");
ALTER TABLE "service_plans" ADD CONSTRAINT "service_plans_code_key" UNIQUE ("code");
ALTER TABLE "household_service_plans" ADD CONSTRAINT "household_service_plans_householdId_key" UNIQUE ("householdId");
ALTER TABLE "orders" ADD CONSTRAINT "orders_orderNo_key" UNIQUE ("orderNo");
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_taskNo_key" UNIQUE ("taskNo");
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_rescheduledToId_key" UNIQUE ("rescheduledToId");
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_taskId_key" UNIQUE ("taskId");
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_incidentNo_key" UNIQUE ("incidentNo");
ALTER TABLE "assurance_reports" ADD CONSTRAINT "assurance_reports_reportNo_key" UNIQUE ("reportNo");
ALTER TABLE "assurance_report_sources" ADD CONSTRAINT "assurance_report_sources_taskId_key" UNIQUE ("taskId");
ALTER TABLE "assurance_report_sources" ADD CONSTRAINT "assurance_report_sources_reportId_visitRecordId_key" UNIQUE ("reportId", "visitRecordId");
ALTER TABLE "service_change_requests" ADD CONSTRAINT "service_change_requests_requestNo_key" UNIQUE ("requestNo");
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_caseNo_key" UNIQUE ("caseNo");
ALTER TABLE "service_catalog_items" ADD CONSTRAINT "service_catalog_items_serviceType_key" UNIQUE ("serviceType");
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_event_key" UNIQUE ("event");

CREATE INDEX "users_role_status_idx" ON "users" ("role", "status");
CREATE INDEX "users_cityId_idx" ON "users" ("cityId");
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions" ("userId", "expiresAt");
CREATE INDEX "households_status_cityId_idx" ON "households" ("status", "cityId");
CREATE INDEX "households_primarySpecialistId_idx" ON "households" ("primarySpecialistId");
CREATE INDEX "households_consultantId_idx" ON "households" ("consultantId");
CREATE INDEX "elders_householdId_idx" ON "elders" ("householdId");
CREATE INDEX "family_members_householdId_idx" ON "family_members" ("householdId");
CREATE INDEX "consents_granteeId_status_idx" ON "consents" ("granteeId", "status");
CREATE INDEX "consents_elderId_status_idx" ON "consents" ("elderId", "status");
CREATE INDEX "staff_profiles_serviceStatus_cityId_idx" ON "staff_profiles" ("serviceStatus", "cityId");
CREATE INDEX "education_records_staffProfileId_idx" ON "education_records" ("staffProfileId");
CREATE INDEX "training_records_status_idx" ON "training_records" ("status");
CREATE INDEX "staff_availability_staffProfileId_startAt_idx" ON "staff_availability" ("staffProfileId", "startAt");
CREATE INDEX "household_assessments_householdId_idx" ON "household_assessments" ("householdId");
CREATE INDEX "subscriptions_status_currentPeriodEnd_idx" ON "subscriptions" ("status", "currentPeriodEnd");
CREATE INDEX "subscriptions_householdId_idx" ON "subscriptions" ("householdId");
CREATE INDEX "orders_householdId_status_idx" ON "orders" ("householdId", "status");
CREATE INDEX "orders_createdAt_idx" ON "orders" ("createdAt");
CREATE INDEX "service_tasks_staffProfileId_scheduledStart_idx" ON "service_tasks" ("staffProfileId", "scheduledStart");
CREATE INDEX "service_tasks_householdId_scheduledStart_idx" ON "service_tasks" ("householdId", "scheduledStart");
CREATE INDEX "service_tasks_status_scheduledStart_idx" ON "service_tasks" ("status", "scheduledStart");
CREATE INDEX "visit_records_householdId_submittedAt_idx" ON "visit_records" ("householdId", "submittedAt");
CREATE INDEX "visit_records_staffProfileId_submittedAt_idx" ON "visit_records" ("staffProfileId", "submittedAt");
CREATE INDEX "health_readings_elderId_measuredAt_idx" ON "health_readings" ("elderId", "measuredAt");
CREATE INDEX "incidents_status_occurredAt_idx" ON "incidents" ("status", "occurredAt");
CREATE INDEX "incidents_householdId_idx" ON "incidents" ("householdId");
CREATE INDEX "incident_events_incidentId_occurredAt_idx" ON "incident_events" ("incidentId", "occurredAt");
CREATE INDEX "assurance_reports_householdId_periodStart_idx" ON "assurance_reports" ("householdId", "periodStart");
CREATE INDEX "assurance_reports_status_idx" ON "assurance_reports" ("status");
CREATE INDEX "timeline_events_householdId_occurredAt_idx" ON "timeline_events" ("householdId", "occurredAt");
CREATE INDEX "service_change_requests_status_createdAt_idx" ON "service_change_requests" ("status", "createdAt");
CREATE INDEX "feedback_cases_status_createdAt_idx" ON "feedback_cases" ("status", "createdAt");
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications" ("userId", "readAt");
CREATE INDEX "notifications_level_createdAt_idx" ON "notifications" ("level", "createdAt");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs" ("userId", "createdAt");
CREATE INDEX "audit_logs_resource_resourceId_idx" ON "audit_logs" ("resource", "resourceId");
CREATE INDEX "audit_logs_action_createdAt_idx" ON "audit_logs" ("action", "createdAt");
CREATE INDEX "specialist_change_logs_householdId_createdAt_idx" ON "specialist_change_logs" ("householdId", "createdAt");

ALTER TABLE "districts" ADD CONSTRAINT "districts_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "family_members"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_primarySpecialistId_fkey" FOREIGN KEY ("primarySpecialistId") REFERENCES "staff_profiles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "households" ADD CONSTRAINT "households_backupSpecialistId_fkey" FOREIGN KEY ("backupSpecialistId") REFERENCES "staff_profiles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "elders" ADD CONSTRAINT "elders_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "elder_sensitive_info" ADD CONSTRAINT "elder_sensitive_info_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_grantorId_fkey" FOREIGN KEY ("grantorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "consents" ADD CONSTRAINT "consents_granteeId_fkey" FOREIGN KEY ("granteeId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_profiles" ADD CONSTRAINT "staff_profiles_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "districts"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "education_records" ADD CONSTRAINT "education_records_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_records" ADD CONSTRAINT "training_records_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "training_courses"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "staff_competencies" ADD CONSTRAINT "staff_competencies_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_competencies" ADD CONSTRAINT "staff_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_availability" ADD CONSTRAINT "staff_availability_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_performance_snapshots" ADD CONSTRAINT "staff_performance_snapshots_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_service_plans" ADD CONSTRAINT "household_service_plans_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_service_plans" ADD CONSTRAINT "household_service_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "service_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "household_assessments" ADD CONSTRAINT "household_assessments_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "household_assessments" ADD CONSTRAINT "household_assessments_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "service_plans"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "service_tasks" ADD CONSTRAINT "service_tasks_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "visit_records" ADD CONSTRAINT "visit_records_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "health_readings" ADD CONSTRAINT "health_readings_visitRecordId_fkey" FOREIGN KEY ("visitRecordId") REFERENCES "visit_records"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "assurance_reports" ADD CONSTRAINT "assurance_reports_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assurance_reports" ADD CONSTRAINT "assurance_reports_elderId_fkey" FOREIGN KEY ("elderId") REFERENCES "elders"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "assurance_reports" ADD CONSTRAINT "assurance_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "assurance_report_sources" ADD CONSTRAINT "assurance_report_sources_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "assurance_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "assurance_report_sources" ADD CONSTRAINT "assurance_report_sources_visitRecordId_fkey" FOREIGN KEY ("visitRecordId") REFERENCES "visit_records"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "assurance_report_sources" ADD CONSTRAINT "assurance_report_sources_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_change_requests" ADD CONSTRAINT "service_change_requests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "service_tasks"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "service_change_requests" ADD CONSTRAINT "service_change_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "feedback_cases" ADD CONSTRAINT "feedback_cases_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "specialist_change_logs" ADD CONSTRAINT "specialist_change_logs_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 第二层防护：全部业务表启用 RLS 且不建任何 policy。
-- 表 owner（Prisma 用的 postgres 角色）默认绕过 RLS，照常读写；
-- 而 anon / authenticated 即使拿到 key 也读不到任何一行。
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "districts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "households" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "elders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "elder_sensitive_info" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "family_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "education_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_courses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "training_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_competencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_availability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "staff_performance_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_service_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "household_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "visit_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_readings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incident_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assurance_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assurance_report_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feedback_cases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "service_catalog_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specialist_change_logs" ENABLE ROW LEVEL SECURITY;
