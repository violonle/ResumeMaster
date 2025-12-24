/**
 * 数据库性能优化脚本
 * 创建索引、优化查询、分析表结构
 */

const { sequelize, User, Resume, AnalysisResult, Job, Order, ResumeJob, UserActivity } = require('../models');

async function optimizeDatabase() {
  console.log('🚀 开始数据库性能优化...');
  
  try {
    // 1. 分析当前表结构
    console.log('📊 分析表结构...');
    await analyzeTableStructure();
    
    // 2. 创建性能索引
    console.log('🔍 创建性能索引...');
    await createPerformanceIndexes();
    
    // 3. 优化查询缓存
    console.log('💾 优化查询缓存...');
    await optimizeQueryCache();
    
    // 4. 清理过期数据
    console.log('🧹 清理过期数据...');
    await cleanupExpiredData();
    
    console.log('✅ 数据库性能优化完成！');
    
  } catch (error) {
    console.error('❌ 数据库优化失败:', error);
    throw error;
  }
}

/**
 * 分析表结构
 */
async function analyzeTableStructure() {
  try {
    // 获取所有表的信息
    const tables = ['users', 'resumes', 'analysis_results', 'jobs', 'orders', 'resume_jobs', 'user_activities'];
    
    for (const table of tables) {
      try {
        const [results] = await sequelize.query(`SHOW TABLE STATUS LIKE '${table}'`);
        if (results.length > 0) {
          console.log(`  📋 ${table}: ${results[0].Rows} 行, ${Math.round(results[0].Data_length / 1024 / 1024 * 100) / 100} MB`);
        }
      } catch (error) {
        console.log(`  ⚠️  无法分析表 ${table}: ${error.message}`);
      }
    }
    
    // 检查索引使用情况
    console.log('  🔍 检查索引使用情况...');
    const [indexUsage] = await sequelize.query(`
      SELECT 
        table_name,
        index_name,
        cardinality,
        sub_part
      FROM information_schema.statistics 
      WHERE table_schema = DATABASE()
      ORDER BY table_name, index_name
    `);
    
    console.log(`  📈 发现 ${indexUsage.length} 个索引`);
    
  } catch (error) {
    console.error('  ❌ 表结构分析失败:', error);
  }
}

/**
 * 创建性能索引
 */
async function createPerformanceIndexes() {
  const indexes = [
    // 用户表索引
    {
      table: 'users',
      index: 'idx_users_active_role',
      columns: ['is_active', 'role'],
      comment: '活跃用户角色查询优化'
    },
    {
      table: 'users',
      index: 'idx_users_subscription',
      columns: ['subscription_status', 'subscription_end_date'],
      comment: '订阅状态查询优化'
    },
    
    // 简历表索引
    {
      table: 'resumes',
      index: 'idx_resumes_user_status_date',
      columns: ['user_id', 'status', 'upload_date'],
      comment: '用户简历状态时间查询优化'
    },
    {
      table: 'resumes',
      index: 'idx_resumes_analysis_count',
      columns: ['analysis_count', 'last_analysis_date'],
      comment: '分析次数查询优化'
    },
    
    // 分析结果表索引
    {
      table: 'analysis_results',
      index: 'idx_analysis_user_score_date',
      columns: ['user_id', 'overall_score', 'analysis_date'],
      comment: '用户分析评分时间查询优化'
    },
    {
      table: 'analysis_results',
      index: 'idx_analysis_favorite',
      columns: ['is_favorite', 'analysis_date'],
      comment: '收藏分析结果查询优化'
    },
    
    // 职位表索引
    {
      table: 'jobs',
      index: 'idx_jobs_user_status_expiry',
      columns: ['user_id', 'status', 'expiry_date'],
      comment: '用户职位状态过期查询优化'
    },
    {
      table: 'jobs',
      index: 'idx_jobs_type_status',
      columns: ['job_type', 'status'],
      comment: '职位类型状态查询优化'
    },
    
    // 订单表索引
    {
      table: 'orders',
      index: 'idx_orders_user_plan_status',
      columns: ['user_id', 'plan', 'status'],
      comment: '用户订单计划状态查询优化'
    },
    {
      table: 'orders',
      index: 'idx_orders_created_status',
      columns: ['created_at', 'status'],
      comment: '订单创建状态查询优化'
    },
    
    // 简历职位关联表索引
    {
      table: 'resume_jobs',
      index: 'idx_resume_jobs_status_score',
      columns: ['status', 'match_score'],
      comment: '申请状态匹配度查询优化'
    },
    
    // 用户活动日志表索引
    {
      table: 'user_activities',
      index: 'idx_activities_user_action_date',
      columns: ['user_id', 'action', 'created_at'],
      comment: '用户活动行为时间查询优化'
    }
  ];
  
  for (const indexConfig of indexes) {
    try {
      console.log(`  🔍 创建索引 ${indexConfig.index}...`);
      
      // 检查索引是否已存在
      const [existingIndexes] = await sequelize.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
        AND table_name = '${indexConfig.table}' 
        AND index_name = '${indexConfig.index}'
      `);
      
      if (existingIndexes[0].count === 0) {
        await sequelize.query(`
          CREATE INDEX ${indexConfig.index} 
          ON ${indexConfig.table} (${indexConfig.columns.join(', ')})
          COMMENT '${indexConfig.comment}'
        `);
        console.log(`    ✅ 索引 ${indexConfig.index} 创建成功`);
      } else {
        console.log(`    ℹ️  索引 ${indexConfig.index} 已存在`);
      }
      
    } catch (error) {
      console.error(`    ❌ 创建索引 ${indexConfig.index} 失败:`, error.message);
    }
  }
}

/**
 * 优化查询缓存
 */
async function optimizeQueryCache() {
  try {
    // 获取经常查询的数据模式
    console.log('  📊 分析查询模式...');
    
    // 为常用查询创建物化视图或缓存表
    const cacheQueries = [
      {
        name: '用户统计缓存',
        query: `
          SELECT 
            u.id as user_id,
            u.role,
            u.subscription_status,
            COUNT(r.id) as resume_count,
            COUNT(ar.id) as analysis_count,
            MAX(ar.analysis_date) as last_analysis_date
          FROM users u
          LEFT JOIN resumes r ON u.id = r.user_id
          LEFT JOIN analysis_results ar ON r.id = ar.resume_id
          WHERE u.is_active = true
          GROUP BY u.id
        `
      }
    ];
    
    // 这里可以实现Redis缓存或其他缓存机制
    console.log('  💡 建议使用Redis缓存用户统计数据');
    
  } catch (error) {
    console.error('  ❌ 查询缓存优化失败:', error);
  }
}

/**
 * 清理过期数据
 */
async function cleanupExpiredData() {
  try {
    console.log('  🧹 清理过期数据...');
    
    // 清理过期订单
    const [expiredOrders] = await sequelize.query(`
      UPDATE orders 
      SET status = 'expired' 
      WHERE status = 'pending' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    console.log(`    🗑️  清理了 ${expiredOrders.affectedRows} 个过期订单`);
    
    // 清理过期职位
    const [expiredJobs] = await sequelize.query(`
      UPDATE jobs 
      SET status = 'closed' 
      WHERE status = 'active' 
      AND expiry_date < NOW()
    `);
    console.log(`    🗑️  清理了 ${expiredJobs.affectedRows} 个过期职位`);
    
    // 清理旧的活动日志（保留90天）
    const [oldActivities] = await sequelize.query(`
      DELETE FROM user_activities 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    `);
    console.log(`    🗑️  清理了 ${oldActivities.affectedRows} 条旧活动日志`);
    
  } catch (error) {
    console.error('  ❌ 数据清理失败:', error);
  }
}

/**
 * 获取数据库性能统计
 */
async function getPerformanceStats() {
  try {
    const stats = {};
    
    // 表大小统计
    const [tableSizes] = await sequelize.query(`
      SELECT 
        table_name,
        table_rows,
        ROUND(data_length / 1024 / 1024, 2) as data_mb,
        ROUND(index_length / 1024 / 1024, 2) as index_mb
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
      ORDER BY data_length DESC
    `);
    
    stats.tableSizes = tableSizes;
    
    // 索引使用情况
    const [indexUsage] = await sequelize.query(`
      SELECT 
        table_name,
        index_name,
        cardinality,
        ROUND((cardinality / table_rows) * 100, 2) as selectivity_pct
      FROM information_schema.statistics s
      JOIN information_schema.tables t 
        ON s.table_name = t.table_name 
        AND s.table_schema = t.table_schema
      WHERE s.table_schema = DATABASE()
        AND t.table_rows > 0
      ORDER BY selectivity_pct DESC
    `);
    
    stats.indexUsage = indexUsage;
    
    return stats;
    
  } catch (error) {
    console.error('获取性能统计失败:', error);
    return null;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  optimizeDatabase()
    .then(async () => {
      console.log('\n📈 性能统计:');
      const stats = await getPerformanceStats();
      if (stats) {
        console.log('表大小统计:', JSON.stringify(stats.tableSizes, null, 2));
        console.log('索引使用情况:', JSON.stringify(stats.indexUsage.slice(0, 10), null, 2));
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = {
  optimizeDatabase,
  getPerformanceStats
};