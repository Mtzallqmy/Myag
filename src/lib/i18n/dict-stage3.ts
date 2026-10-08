// Stage 3 strings: multi-agent, memory, history, search, usage, notifications, admin.
export const ar3 = {
  nav3: { memory: "الذاكرة", history: "السجل", search: "البحث", usage: "الاستخدام", notifications: "الإشعارات", admin: "لوحة الإدارة" },
  depth: {
    title: "🧠 وضع الوكيل",
    FAST: "⚡ سريع",
    BALANCED: "⚖️ متوازن",
    DEEP: "🧠 عميق",
    MULTI: "👥 متعدد الوكلاء",
    hint: { FAST: "تنفيذ مباشر بخطوة واحدة", BALANCED: "تحليل ثم تنفيذ", DEEP: "تحليل وتنفيذ ومراجعة", MULTI: "خط أدوار محدود: تنسيق، تحليل، تنفيذ، مراجعة، أمان، اختبار، توثيق" },
  } as { title: string; FAST: string; BALANCED: string; DEEP: string; MULTI: string; hint: Record<string, string> },
  roles: {
    title: "تقدّم الأدوار",
    COORDINATOR: "المنسّق", CODE_ANALYSIS: "تحليل الكود", IMPLEMENTATION: "التنفيذ", REVIEW: "المراجعة", TESTING: "الاختبار",
    SECURITY_REVIEW: "مراجعة الأمان", DOCUMENTATION: "التوثيق", INTEGRATION: "التكامل",
    pending: "بانتظار", done: "تم", skipped: "غير متاح",
  } as Record<string, string>,
  memory: {
    title: "🧠 الذاكرة", conversation: "ذاكرة المحادثات", project: "ذاكرة المشروع", preferences: "التفضيلات", task: "ذاكرة المهام",
    add: "إضافة", placeholder: "اكتب ملاحظة قصيرة يتذكرها الوكيل (بدون أسرار أو كلمات مرور)", clear: "مسح هذا القسم",
    clearConfirm: "مسح كل عناصر هذا القسم؟", empty: "لا توجد عناصر.", source: "المصدر", confidence: "الثقة", expires: "تنتهي",
    rules: "لا تُخزَّن أبدًا: التوكنات، كلمات المرور، المفاتيح الخاصة، الترويسات السرية.",
  },
  history: {
    title: "🧾 السجل", conversations: "المحادثات", jobs: "مهام الوكيل", github: "GitHub", mcp: "MCP", approvals: "الموافقات",
    changes: "التعديلات", tests: "الاختبارات", empty: "لا يوجد سجل بعد.",
  },
  search: {
    title: "🔍 البحث الشامل", placeholder: "ابحث في المحادثات والمشاريع والملفات والمهام والمستودعات…", min: "اكتب حرفين على الأقل.",
    conversations: "المحادثات", projects: "المشاريع", files: "الملفات", jobs: "المهام", repositories: "المستودعات", integrations: "التكاملات", none: "لا نتائج.",
  },
  usage: {
    title: "📊 الاستخدام", daily: "يومي (7 أيام)", monthly: "شهري (30 يومًا)", requests: "الطلبات", inputTokens: "توكنات الإدخال",
    outputTokens: "توكنات الإخراج", cost: "التكلفة التقديرية", jobs: "مهام الوكيل", storage: "التخزين", providers: "المزودات",
    repositories: "المستودعات", mcp: "خوادم MCP", plan: "الخطة", quotas: "الحصص (تُفرض على الخادم)", empty: "لا يوجد استخدام في هذه الفترة.",
    costNote: "التكلفة تقديرية وتظهر فقط عندما يوفّر المزود بيانات السعر.",
    q: {
      messagesPerDay: "الرسائل/اليوم", tokensPerDay: "التوكنات/اليوم", agentJobsPerDay: "المهام/اليوم", concurrentJobs: "المهام المتزامنة",
      storageBytes: "التخزين", providerSpendPerDayUsd: "سقف الإنفاق اليومي ($)", mcpServers: "خوادم MCP", repositories: "المستودعات",
    } as Record<string, string>,
  },
  notif: {
    title: "🔔 الإشعارات", empty: "لا توجد إشعارات.", markAll: "تعليم الكل كمقروء", all: "الكل",
    cat: { APPROVALS: "الموافقات", JOBS: "المهام", GITHUB: "GitHub", INTEGRATIONS: "التكاملات", USAGE: "الاستخدام", SYSTEM: "النظام" } as Record<string, string>,
    t: { JOB_COMPLETED: "اكتملت مهمة", JOB_FAILED: "فشلت مهمة", APPROVAL_NEEDED: "موافقة مطلوبة", QUOTA_EXCEEDED: "تم بلوغ حد الحصة" } as Record<string, string>,
    pushNote: "إشعارات المتصفح الفورية غير مفعّلة بعد — تصلك الإشعارات داخل التطبيق لحظيًا.",
  },
  admin: {
    title: "🛡️ لوحة الإدارة", denied: "ليست لديك صلاحية الوصول إلى لوحة الإدارة.", claim: "تعيين نفسي مديرًا أعلى",
    claimHint: "لا يوجد مدير أعلى بعد. أول من يطالب يحصل على الدور (يُسجَّل في التدقيق).",
    sections: {
      overview: "نظرة عامة", users: "المستخدمون", jobs: "المهام", providers: "المزودات", models: "النماذج", projects: "المشاريع",
      repositories: "المستودعات", mcp: "MCP", usage: "الاستخدام", audit: "التدقيق", flags: "الميزات والطوارئ", health: "صحة النظام",
    } as Record<string, string>,
    flags: "مفاتيح الميزات", switches: "مفاتيح الطوارئ", reason: "السبب", scope: "النطاق", target: "الهدف",
    setPlan: "الخطة", grantRole: "منح دور", revoke: "سحب", filter: "تصفية", from: "من", to: "إلى", action: "الإجراء", entity: "الكيان",
    status: "الحالة", risk: "الخطورة", userId: "معرّف المستخدم", events: "أحداث التطبيق", database: "قاعدة البيانات", runtime: "بيئة التشغيل",
    configured: "مهيأة", notConfigured: "غير مهيأة", latency: "زمن الاستجابة", recentFailures: "إخفاقات آخر 24 ساعة", readOnly: "عرض فقط",
  },
  errors3: {
    KILL_SWITCH: "تم إيقاف هذه العملية مؤقتًا من الإدارة.", FEATURE_DISABLED: "هذه الميزة غير مفعّلة لحسابك.",
    QUOTA_EXCEEDED: "بلغت حد الحصة لخطتك.", MEMORY_SECRET: "لا يمكن حفظ أسرار أو كلمات مرور في الذاكرة.", MEMORY_EMPTY: "النص قصير جدًا.",
    MEMORY_TOO_LONG: "النص طويل جدًا (500 حرف كحد أقصى).", MEMORY_LOW_CONFIDENCE: "ثقة منخفضة.", CANNOT_REMOVE_SELF: "لا يمكنك سحب دورك الأعلى بنفسك.",
    BAD_REQUEST: "طلب غير صالح.", CREATE_FAILED: "تعذّر الحفظ.",
  } as Record<string, string>,
};

export type Dict3 = typeof ar3;

export const en3: Dict3 = {
  nav3: { memory: "Memory", history: "History", search: "Search", usage: "Usage", notifications: "Notifications", admin: "Admin" },
  depth: {
    title: "🧠 Agent mode",
    FAST: "⚡ Fast",
    BALANCED: "⚖️ Balanced",
    DEEP: "🧠 Deep",
    MULTI: "👥 Multi-agent",
    hint: { FAST: "Direct single-step implementation", BALANCED: "Analyze then implement", DEEP: "Analyze, implement, review", MULTI: "Bounded role pipeline: coordinate, analyze, implement, review, security, test, document" },
  },
  roles: {
    title: "Role progress",
    COORDINATOR: "Coordinator", CODE_ANALYSIS: "Code analysis", IMPLEMENTATION: "Implementation", REVIEW: "Review", TESTING: "Testing",
    SECURITY_REVIEW: "Security review", DOCUMENTATION: "Documentation", INTEGRATION: "Integration",
    pending: "Pending", done: "Done", skipped: "Unavailable",
  },
  memory: {
    title: "🧠 Memory", conversation: "Conversation memory", project: "Project memory", preferences: "Preferences", task: "Task memory",
    add: "Add", placeholder: "A short note for the agent to remember (no secrets or passwords)", clear: "Clear this section",
    clearConfirm: "Clear every item in this section?", empty: "No items.", source: "Source", confidence: "Confidence", expires: "Expires",
    rules: "Never stored: tokens, passwords, private keys, secret headers.",
  },
  history: {
    title: "🧾 History", conversations: "Chats", jobs: "Agent jobs", github: "GitHub", mcp: "MCP", approvals: "Approvals",
    changes: "Changes", tests: "Tests", empty: "No history yet.",
  },
  search: {
    title: "🔍 Global search", placeholder: "Search chats, projects, files, jobs, repositories…", min: "Type at least 2 characters.",
    conversations: "Chats", projects: "Projects", files: "Files", jobs: "Jobs", repositories: "Repositories", integrations: "Integrations", none: "No results.",
  },
  usage: {
    title: "📊 Usage", daily: "Daily (7 days)", monthly: "Monthly (30 days)", requests: "Requests", inputTokens: "Input tokens",
    outputTokens: "Output tokens", cost: "Estimated cost", jobs: "Agent jobs", storage: "Storage", providers: "Providers",
    repositories: "Repositories", mcp: "MCP servers", plan: "Plan", quotas: "Quotas (enforced server-side)", empty: "No usage in this period.",
    costNote: "Cost is an estimate and only appears when the provider reports pricing.",
    q: {
      messagesPerDay: "Messages/day", tokensPerDay: "Tokens/day", agentJobsPerDay: "Jobs/day", concurrentJobs: "Concurrent jobs",
      storageBytes: "Storage", providerSpendPerDayUsd: "Daily spend cap ($)", mcpServers: "MCP servers", repositories: "Repositories",
    },
  },
  notif: {
    title: "🔔 Notifications", empty: "No notifications.", markAll: "Mark all read", all: "All",
    cat: { APPROVALS: "Approvals", JOBS: "Jobs", GITHUB: "GitHub", INTEGRATIONS: "Integrations", USAGE: "Usage", SYSTEM: "System" },
    t: { JOB_COMPLETED: "Job completed", JOB_FAILED: "Job failed", APPROVAL_NEEDED: "Approval needed", QUOTA_EXCEEDED: "Quota limit reached" },
    pushNote: "Browser push notifications aren't enabled yet — in-app notifications arrive in real time.",
  },
  admin: {
    title: "🛡️ Admin", denied: "You don't have access to the admin area.", claim: "Make me super admin",
    claimHint: "No super admin exists yet. The first to claim gets the role (audited).",
    sections: {
      overview: "Overview", users: "Users", jobs: "Jobs", providers: "Providers", models: "Models", projects: "Projects",
      repositories: "Repositories", mcp: "MCP", usage: "Usage", audit: "Audit", flags: "Flags & kill switches", health: "System health",
    },
    flags: "Feature flags", switches: "Kill switches", reason: "Reason", scope: "Scope", target: "Target",
    setPlan: "Plan", grantRole: "Grant role", revoke: "Revoke", filter: "Filter", from: "From", to: "To", action: "Action", entity: "Entity",
    status: "Status", risk: "Risk", userId: "User ID", events: "App events", database: "Database", runtime: "Agent runtime",
    configured: "Configured", notConfigured: "Not configured", latency: "Latency", recentFailures: "Failures (last 24h)", readOnly: "Read only",
  },
  errors3: {
    KILL_SWITCH: "This action is temporarily disabled by the admins.", FEATURE_DISABLED: "This feature isn't enabled for your account.",
    QUOTA_EXCEEDED: "You've reached your plan's quota.", MEMORY_SECRET: "Secrets or passwords can't be stored in memory.", MEMORY_EMPTY: "Text is too short.",
    MEMORY_TOO_LONG: "Text is too long (500 characters max).", MEMORY_LOW_CONFIDENCE: "Low confidence.", CANNOT_REMOVE_SELF: "You can't revoke your own super admin role.",
    BAD_REQUEST: "Invalid request.", CREATE_FAILED: "Couldn't save.",
  },
};
