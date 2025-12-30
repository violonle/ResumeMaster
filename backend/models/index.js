const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

// 用户模型
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    username: {
      type: DataTypes.STRING(50),
      unique: true,
      allowNull: true,
      validate: {
        len: [2, 50]
      }
    },
    email: {
      type: DataTypes.STRING(100),
      unique: true,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    phone: {
      type: DataTypes.STRING(20),
      unique: true,
      allowNull: true,
      validate: {
        is: /^[\d\s\-\+\(\)]+$/
      }
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    avatar: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    company_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: '所属公司ID，多租户隔离关键字段'
    },
    role: {
    type: DataTypes.ENUM('user', 'premium', 'enterprise', 'admin'),
    defaultValue: 'user'
  },
  subscription_status: {
    type: DataTypes.ENUM('active', 'inactive', 'cancelled', 'expired'),
    defaultValue: 'inactive'
  },
  subscription_end_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  phone_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  login_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['email']
    },
    {
      unique: true,
      fields: ['phone']
    },
    {
      unique: true,
      fields: ['username']
    },
    {
      fields: ['role']
    },
    {
      fields: ['subscription_status']
    },
    {
      fields: ['is_active']
    }
  ]
});

// 简历模型
const Resume = sequelize.define('Resume', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 10 * 1024 * 1024 // 10MB限制
    }
  },
  file_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      isIn: [['pdf', 'docx', 'doc', 'txt', 'html', 'link']]
    }
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false
  },
  upload_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  parsed_data: {
    type: DataTypes.JSON,
    allowNull: true
  },
  raw_text: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('uploaded', 'parsing', 'analyzed', 'failed', 'archived'),
    defaultValue: 'uploaded'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  analysis_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_analysis_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  download_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  source: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'manual'
  },
  is_talent_pool: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '姓名'
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '电话'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '邮箱'
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true,
    comment: '城市/地址'
  },
  job_title: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '职位'
  },
  experience_years: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '工作经验（年）'
  },
  highest_education: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '最高学历'
  },
  job_status: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: '求职状态'
  },
  expected_salary: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '期望薪资'
  },
  work_experience: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '工作经历'
  },
  education: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '教育经历'
  },
  skills: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '技能专长'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '个人优势'
  },
  projects: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '项目经历'
  },
  recruitment_status: {
    type: DataTypes.ENUM('投递', '初筛', '面试', 'Offer', '入职', '放弃'),
    defaultValue: '投递',
    comment: '招聘流程状态'
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'AI匹配得分'
  }
}, {
  tableName: 'resumes',
  timestamps: true,
  createdAt: 'upload_date',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['upload_date']
    },
    {
      fields: ['user_id', 'status']
    },
    {
      fields: ['recruitment_status']
    }
  ]
});

// 分析结果模型
const AnalysisResult = sequelize.define('AnalysisResult', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  resume_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'resumes',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  analysis_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  overall_score: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  suggestions: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  strengths: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  weaknesses: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '核心画像/分析总结'
  },
  hiring_advice: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  target_job: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: null
  },
  detailed_analysis: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  },
  ai_provider: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  ai_model: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  processing_time: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '分析处理时间（毫秒）'
  },
  is_favorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'analysis_results',
  timestamps: true,
  createdAt: 'analysis_date',
  updatedAt: false,
  indexes: [
    {
      fields: ['resume_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['analysis_date']
    },
    {
      fields: ['overall_score']
    },
    {
      fields: ['resume_id', 'user_id']
    }
  ]
});

// 深度解析记录表 (Deep Analysis Records) - 新建
const DeepAnalysisRecord = sequelize.define('DeepAnalysisRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  resume_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'resumes',
      key: 'id'
    }
  },
  job_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  type: {
    type: DataTypes.ENUM('single', 'multi'),
    defaultValue: 'single'
  },
  overall_score: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '包含 skills, experience, education, stability, potential, teamwork 六个维度'
  },
  details: {
    type: DataTypes.JSON,
    allowNull: false,
    comment: '完整的 AI 解析结果'
  },
  analysis_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'deep_analysis_records',
  timestamps: true,
  createdAt: 'analysis_date',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['resume_id'] },
    { fields: ['type'] },
    { fields: ['overall_score'] }
  ]
});

// 职位模型
const Job = sequelize.define('Job', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
    validate: {
      len: [1, 200]
    }
  },
  description: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  requirements: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  responsibilities: {
    type: DataTypes.TEXT('long'),
    allowNull: true
  },
  salary_range: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  experience_required: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  education_required: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  job_type: {
    type: DataTypes.ENUM('full_time', 'part_time', 'contract', 'internship', 'remote'),
    defaultValue: 'full_time'
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('active', 'paused', 'closed', 'draft'),
    defaultValue: 'draft'
  },
  urgency: {
    type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
    defaultValue: 'medium'
  },
  positions_count: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  application_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'jobs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['job_type']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['expiry_date']
    },
    {
      fields: ['user_id', 'status']
    }
  ]
});

// 订单模型（订阅支付）
const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  plan: {
    type: DataTypes.ENUM('premium', 'enterprise', 'basic'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'CNY'
  },
  provider: {
    type: DataTypes.ENUM('wechat', 'alipay', 'stripe', 'paypal'),
    allowNull: false
  },
  out_trade_no: {
    type: DataTypes.STRING(64),
    unique: true
  },
  transaction_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded'),
    defaultValue: 'pending'
  },
  payment_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  code_url: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  refund_amount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  refund_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {}
  }
}, {
  tableName: 'orders',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['out_trade_no']
    },
    {
      fields: ['transaction_id']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['user_id', 'status']
    }
  ]
});

// 发票模型
const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  invoiceNo: {
    type: DataTypes.STRING(64),
    unique: true,
    allowNull: false
  },
  orderId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'orders',
      key: 'id'
    }
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  planType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  paymentMethod: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  transactionId: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('issued', 'red_issued', 'red_reversed'),
    defaultValue: 'issued'
  },
  issuedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  buyerName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  buyerTaxNumber: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  buyerAddress: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  buyerPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  buyerBank: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  invoiceDate: {
    type: DataTypes.STRING(20),
    allowNull: true
  },
  serviceDescription: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  servicePeriod: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  originalInvoiceId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  redReason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  redInvoiceId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['invoiceNo']
    },
    {
      fields: ['orderId']
    },
    {
      fields: ['userId']
    },
    {
      fields: ['status']
    }
  ]
});

// 招聘流程模型（公司级配置）
const RecruitmentProcess = sequelize.define('RecruitmentProcess', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  company_name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  steps: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: []
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  status: {
    type: DataTypes.ENUM('active', 'archived'),
    defaultValue: 'active'
  }
}, {
  tableName: 'recruitment_processes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    }
  ]
});

// 简历职位关联模型（申请记录）
const ResumeJob = sequelize.define('ResumeJob', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  resume_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'resumes',
      key: 'id'
    }
  },
  job_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'),
    defaultValue: 'applied'
  },
  applied_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  match_score: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 0,
      max: 100
    }
  },
  recruiter_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'resume_jobs',
  timestamps: true,
  createdAt: 'applied_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      fields: ['resume_id']
    },
    {
      fields: ['job_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      unique: true,
      fields: ['resume_id', 'job_id']
    }
  ]
});

// 用户活动日志模型
const UserActivity = sequelize.define('UserActivity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  company_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: '所属公司ID'
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  resource_type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  resource_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true
  },
  user_agent: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'user_activities',
  timestamps: false,
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['action']
    },
    {
      fields: ['resource_type', 'resource_id']
    },
    {
      fields: ['created_at']
    }
  ]
});

// 系统配置模型
const SystemConfig = sequelize.define('SystemConfig', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  type: {
    type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
    defaultValue: 'string'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'system_configs',
  timestamps: false,
  indexes: [
    {
      fields: ['key']
    },
    {
      fields: ['is_public']
    }
  ]
});

// 企业模型
const Company = sequelize.define('Company', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  address: { type: DataTypes.STRING(500), allowNull: true },
  province: { type: DataTypes.STRING(100), allowNull: true },
  city: { type: DataTypes.STRING(100), allowNull: true },
  district: { type: DataTypes.STRING(100), allowNull: true },
  industry: { type: DataTypes.STRING(100), allowNull: true },
  contact_name: { type: DataTypes.STRING(100), allowNull: true },
  contact_phone: { type: DataTypes.STRING(50), allowNull: true },
  size: { type: DataTypes.STRING(50), allowNull: true },
  founding_year: { type: DataTypes.STRING(10), allowNull: true },
  website: { type: DataTypes.STRING(200), allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  contact_account_id: { type: DataTypes.INTEGER, allowNull: true },
  is_verified: { type: DataTypes.BOOLEAN, defaultValue: false },
  verification_status: { type: DataTypes.ENUM('none', 'pending', 'verified', 'rejected'), defaultValue: 'none' },
  verification_info: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
  code: { type: DataTypes.STRING(50), allowNull: true, unique: true },
  status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
}, {
  tableName: 'companies',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

const CompanyMember = sequelize.define('CompanyMember', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  company_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'member', 'viewer'), defaultValue: 'member' },
  status: { type: DataTypes.ENUM('active', 'invited', 'disabled'), defaultValue: 'active' },
  joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  tableName: 'company_members',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['company_id', 'user_id'] }
  ]
});

// 定义模型关系
User.hasMany(Resume, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Resume.belongsTo(User, { foreignKey: 'user_id' });

Resume.hasMany(AnalysisResult, { foreignKey: 'resume_id', onDelete: 'CASCADE' });
AnalysisResult.belongsTo(Resume, { foreignKey: 'resume_id' });
AnalysisResult.belongsTo(User, { foreignKey: 'user_id' });

Resume.hasMany(DeepAnalysisRecord, { foreignKey: 'resume_id', onDelete: 'CASCADE' });
DeepAnalysisRecord.belongsTo(Resume, { foreignKey: 'resume_id' });
DeepAnalysisRecord.belongsTo(User, { foreignKey: 'user_id' });
DeepAnalysisRecord.belongsTo(Job, { foreignKey: 'job_id' });

User.hasMany(Job, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Job.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Order, { foreignKey: 'user_id', onDelete: 'CASCADE' });
Order.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(Invoice, { foreignKey: 'userId', onDelete: 'CASCADE' });
Invoice.belongsTo(User, { foreignKey: 'userId' });

Order.hasMany(Invoice, { foreignKey: 'orderId' });
Invoice.belongsTo(Order, { foreignKey: 'orderId' });

User.hasMany(RecruitmentProcess, { foreignKey: 'user_id', onDelete: 'CASCADE' });
RecruitmentProcess.belongsTo(User, { foreignKey: 'user_id' });

User.hasMany(UserActivity, { foreignKey: 'user_id', onDelete: 'CASCADE' });
UserActivity.belongsTo(User, { foreignKey: 'user_id' });

// 简历与职位的多对多关系
Resume.belongsToMany(Job, { through: ResumeJob, foreignKey: 'resume_id' });
Job.belongsToMany(Resume, { through: ResumeJob, foreignKey: 'job_id' });

Resume.hasMany(ResumeJob, { foreignKey: 'resume_id', onDelete: 'CASCADE' });
ResumeJob.belongsTo(Resume, { foreignKey: 'resume_id' });
Job.hasMany(ResumeJob, { foreignKey: 'job_id', onDelete: 'CASCADE' });
ResumeJob.belongsTo(Job, { foreignKey: 'job_id' });
ResumeJob.belongsTo(User, { foreignKey: 'user_id' });

Company.belongsTo(User, { foreignKey: 'contact_account_id', as: 'Contact' });

// 多租户关联
User.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(User, { foreignKey: 'company_id', as: 'Accounts' });

Job.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(Job, { foreignKey: 'company_id', as: 'Jobs' });

Resume.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(Resume, { foreignKey: 'company_id', as: 'Resumes' });

AnalysisResult.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(AnalysisResult, { foreignKey: 'company_id', as: 'AnalysisResults' });

Order.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(Order, { foreignKey: 'company_id', as: 'Orders' });

Invoice.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(Invoice, { foreignKey: 'company_id', as: 'Invoices' });

RecruitmentProcess.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(RecruitmentProcess, { foreignKey: 'company_id', as: 'RecruitmentProcesses' });

DeepAnalysisRecord.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(DeepAnalysisRecord, { foreignKey: 'company_id', as: 'DeepAnalysisRecords' });

UserActivity.belongsTo(Company, { foreignKey: 'company_id', as: 'Company' });
Company.hasMany(UserActivity, { foreignKey: 'company_id', as: 'UserActivities' });

// Company Members Associations
Company.hasMany(CompanyMember, { foreignKey: 'company_id', as: 'Members' });
CompanyMember.belongsTo(Company, { foreignKey: 'company_id' });
User.hasMany(CompanyMember, { foreignKey: 'user_id', as: 'CompanyMemberships' });
CompanyMember.belongsTo(User, { foreignKey: 'user_id' });

module.exports = {
  User,
  Resume,
  AnalysisResult,
  Job,
  Order,
  RecruitmentProcess,
  ResumeJob,
  UserActivity,
  DeepAnalysisRecord,
  SystemConfig,
  Company,
  CompanyMember,
  // 新增模型开始
  // 订阅模型（公司维度）
  Subscription: (() => {
    const Subscription = sequelize.define('Subscription', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      company_id: { type: DataTypes.INTEGER, allowNull: false },
      plan: { type: DataTypes.ENUM('free', 'pro', 'enterprise'), allowNull: false, defaultValue: 'free' },
      billing_cycle: { type: DataTypes.ENUM('monthly', 'annual'), defaultValue: 'monthly' },
      start_at: { type: DataTypes.DATE, allowNull: true },
      end_at: { type: DataTypes.DATE, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'expired', 'canceled', 'pending'), defaultValue: 'pending' },
      quota: { type: DataTypes.JSON, allowNull: true, defaultValue: { resume_parses_per_month: 100, concurrent: 1, ai_calls: 10000 } },
      payment_provider: { type: DataTypes.STRING(50), allowNull: true },
      order_no: { type: DataTypes.STRING(64), allowNull: true },
      auto_renew: { type: DataTypes.BOOLEAN, defaultValue: false }
    }, {
      tableName: 'subscriptions',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    });
    Subscription.belongsTo(sequelize.models.Company || sequelize.modelManager.getModel('Company'), { foreignKey: 'company_id', as: 'Company' });
    (sequelize.models.Company || sequelize.modelManager.getModel('Company')).hasMany(Subscription, { foreignKey: 'company_id', as: 'Subscriptions' });
    return Subscription;
  })(),

  // 订阅计划模型（可配置）
  SubscriptionPlan: (() => {
    const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(50), unique: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      i18n_names: { type: DataTypes.JSON, allowNull: true, defaultValue: { zh: '', en: '' } },
      features: { type: DataTypes.JSON, allowNull: true, defaultValue: [] },
      quota: { type: DataTypes.JSON, allowNull: true, defaultValue: { resume_parses_per_month: 100, concurrent: 1, ai_calls: 10000 } },
      price: { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
      status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    }, { tableName: 'subscription_plans', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
    return SubscriptionPlan;
  })(),

  // 模型提供商
  ModelProvider: (() => {
    const ModelProvider = sequelize.define('ModelProvider', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      provider: { type: DataTypes.ENUM('modelscope', 'siliconflow', 'qianwen', 'glm', 'deepseek', 'kimi', 'minimax'), allowNull: false },
      adapter_config: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
      enabled: { type: DataTypes.BOOLEAN, defaultValue: true }
    }, { tableName: 'model_providers', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
    return ModelProvider;
  })(),

  // 模型密钥（公司或全局）
  ModelKey: (() => {
    const ModelKey = sequelize.define('ModelKey', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      company_id: { type: DataTypes.INTEGER, allowNull: true },
      provider: { type: DataTypes.ENUM('modelscope', 'siliconflow', 'qianwen', 'glm', 'deepseek', 'kimi', 'minimax'), allowNull: false },
      // model: { type: DataTypes.STRING(100), allowNull: true }, // DB schema mismatch
      api_key: { type: DataTypes.STRING(255), allowNull: false },
      limits: { type: DataTypes.JSON, allowNull: true, defaultValue: { rpm: 60, rpd: 10000 } },
      scope: { type: DataTypes.ENUM('global', 'company'), defaultValue: 'company' },
      // enabled: { type: DataTypes.BOOLEAN, defaultValue: true } // DB schema mismatch
    }, { tableName: 'model_keys', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
    ModelKey.belongsTo(sequelize.models.Company || sequelize.modelManager.getModel('Company'), { foreignKey: 'company_id', as: 'Company' });
    return ModelKey;
  })(),

  // 角色与权限
  Role: (() => {
    const Role = sequelize.define('Role', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(100), unique: true, allowNull: false },
      name: { type: DataTypes.STRING(100), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: { type: DataTypes.ENUM('active', 'inactive'), defaultValue: 'active' }
    }, { tableName: 'roles', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });
    const RolePermission = sequelize.define('RolePermission', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      role_id: { type: DataTypes.INTEGER, allowNull: false },
      permission_key: { type: DataTypes.STRING(200), allowNull: false }
    }, { tableName: 'role_permissions', timestamps: false });
    const UserRole = sequelize.define('UserRole', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      role_id: { type: DataTypes.INTEGER, allowNull: false }
    }, { tableName: 'user_roles', timestamps: false });
    Role.hasMany(RolePermission, { foreignKey: 'role_id', as: 'Permissions' });
    RolePermission.belongsTo(Role, { foreignKey: 'role_id' });
    User.belongsToMany(Role, { through: UserRole, foreignKey: 'user_id', as: 'Roles' });
    Role.belongsToMany(User, { through: UserRole, foreignKey: 'role_id', as: 'Users' });
    return Role;
  })(),

  // 审计日志
  AuditLog: (() => {
    const AuditLog = sequelize.define('AuditLog', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      actor_account_id: { type: DataTypes.INTEGER, allowNull: false },
      action: { type: DataTypes.STRING(100), allowNull: false },
      resource_type: { type: DataTypes.STRING(50), allowNull: true },
      resource_id: { type: DataTypes.INTEGER, allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
      ip: { type: DataTypes.STRING(45), allowNull: true },
      ua: { type: DataTypes.STRING(500), allowNull: true },
      occurred_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
    }, { tableName: 'audit_logs', timestamps: false });
    AuditLog.belongsTo(User, { foreignKey: 'actor_account_id', as: 'Actor' });
    return AuditLog;
  })(),
  // 验证码记录
  VerificationCode: (() => {
    const VerificationCode = sequelize.define('VerificationCode', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      phone: { type: DataTypes.STRING(20), allowNull: false },
      code: { type: DataTypes.STRING(10), allowNull: false },
      type: { type: DataTypes.STRING(20), defaultValue: 'login' },
      status: { type: DataTypes.ENUM('sent', 'used', 'expired'), defaultValue: 'sent' },
      ip: { type: DataTypes.STRING(45), allowNull: true },
      expires_at: { type: DataTypes.DATE, allowNull: false }
    }, { 
      tableName: 'verification_codes', 
      timestamps: true, 
      createdAt: 'created_at', 
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['phone', 'created_at'] },
        { fields: ['phone', 'code', 'status', 'expires_at'] }
      ]
    });
    return VerificationCode;
  })(),

  // 提示词模板模型
  PromptTemplate: (() => {
    const PromptTemplate = sequelize.define('PromptTemplate', {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      key: { type: DataTypes.STRING(100), unique: true, allowNull: false, comment: '唯一标识符' },
      name: { type: DataTypes.STRING(100), allowNull: false, comment: '模板名称' },
      content: { type: DataTypes.TEXT('long'), allowNull: false, comment: '模板内容' },
      variables: { type: DataTypes.JSON, allowNull: true, defaultValue: [], comment: '变量列表' },
      description: { type: DataTypes.TEXT, allowNull: true, comment: '描述' },
      category: { type: DataTypes.STRING(50), defaultValue: 'general', comment: '分类' },
      is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
      version: { type: DataTypes.INTEGER, defaultValue: 1 }
    }, {
      tableName: 'prompt_templates',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['key'], unique: true },
        { fields: ['category'] }
      ]
    });
    return PromptTemplate;
  })(),

  sequelize
};
