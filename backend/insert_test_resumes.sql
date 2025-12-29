-- 为用户ID=2, company_id=5创建测试简历数据
-- 招聘流程管理页面需要这些数据来展示各个节点

INSERT INTO resumes (user_id, company_id, name, file_name, file_size, file_type, file_path, status, recruitment_status, upload_date, parsed_data, tags, updated_at) VALUES
(2, 5, '张伟', '前端开发工程师_张伟.pdf', 245760, 'pdf', '/uploads/resumes/test1.pdf', 'analyzed', '投递', datetime('now'),
'{"name":"张伟","email":"zhangwei@example.com","phone":"13800138001","jobTitle":"前端开发工程师","position":"前端开发工程师","education":[{"degree":"本科","school":"清华大学"}],"experience":[{"company":"阿里巴巴","position":"前端工程师"}],"skills":["Vue.js","React","TypeScript","Node.js"]}',
'["Vue.js","React","前端开发"]', datetime('now')),

(2, 5, '李娜', '产品经理_李娜.docx', 204800, 'docx', '/uploads/resumes/test2.docx', 'analyzed', '初筛', datetime('now', '-1 day'),
'{"name":"李娜","email":"lina@example.com","phone":"13800138002","jobTitle":"产品经理","position":"产品经理","education":[{"degree":"硕士","school":"北京大学"}],"experience":[{"company":"腾讯","position":"产品经理"}],"skills":["产品规划","需求分析","Axure","Figma"]}',
'["产品经理","Axure","Figma"]', datetime('now', '-1 day')),

(2, 5, '王强', 'Java后端_王强.pdf', 262144, 'pdf', '/uploads/resumes/test3.pdf', 'analyzed', '面试', datetime('now', '-2 days'),
'{"name":"王强","email":"wangqiang@example.com","phone":"13800138003","jobTitle":"Java后端工程师","position":"Java后端工程师","education":[{"degree":"本科","school":"浙江大学"}],"experience":[{"company":"字节跳动","position":"后端工程师"}],"skills":["Java","Spring Boot","MySQL","Redis"]}',
'["Java","Spring Boot","后端开发"]', datetime('now', '-2 days')),

(2, 5, '刘芳', 'UI设计师_刘芳.pdf', 180224, 'pdf', '/uploads/resumes/test4.pdf', 'analyzed', 'Offer', datetime('now', '-3 days'),
'{"name":"刘芳","email":"liufang@example.com","phone":"13800138004","jobTitle":"UI设计师","position":"UI设计师","education":[{"degree":"本科","school":"中央美术学院"}],"experience":[{"company":"美团","position":"UI设计师"}],"skills":["Figma","Sketch","Photoshop","Illustrator"]}',
'["UI设计","Figma","Sketch"]', datetime('now', '-3 days')),

(2, 5, '陈明', '全栈工程师_陈明.pdf', 229376, 'pdf', '/uploads/resumes/test5.pdf', 'analyzed', '入职', datetime('now', '-5 days'),
'{"name":"陈明","email":"chenming@example.com","phone":"13800138005","jobTitle":"全栈工程师","position":"全栈工程师","education":[{"degree":"硕士","school":"上海交通大学"}],"experience":[{"company":"京东","position":"全栈工程师"}],"skills":["Vue.js","Java","Python","Docker"]}',
'["全栈开发","Vue.js","Java"]', datetime('now', '-5 days')),

(2, 5, '赵磊', '测试工程师_赵磊.pdf', 196608, 'pdf', '/uploads/resumes/test6.pdf', 'analyzed', '放弃', datetime('now', '-4 days'),
'{"name":"赵磊","email":"zhaolei@example.com","phone":"13800138006","jobTitle":"测试工程师","position":"测试工程师","education":[{"degree":"本科","school":"华中科技大学"}],"experience":[{"company":"华为","position":"测试工程师"}],"skills":["Selenium","JMeter","Postman","Python"]}',
'["测试工程师","Selenium","JMeter"]', datetime('now', '-4 days')),

(2, 5, '孙婷', '数据分析师_孙婷.pdf', 212992, 'pdf', '/uploads/resumes/test7.pdf', 'analyzed', '投递', datetime('now', '-6 hours'),
'{"name":"孙婷","email":"sunting@example.com","phone":"13800138007","jobTitle":"数据分析师","position":"数据分析师","education":[{"degree":"硕士","school":"复旦大学"}],"experience":[{"company":"网易","position":"数据分析师"}],"skills":["Python","SQL","Tableau","PowerBI"]}',
'["数据分析","Python","SQL"]', datetime('now', '-6 hours')),

(2, 5, '周杰', '运维工程师_周杰.pdf', 237568, 'pdf', '/uploads/resumes/test8.pdf', 'analyzed', '初筛', datetime('now', '-12 hours'),
'{"name":"周杰","email":"zhoujie@example.com","phone":"13800138008","jobTitle":"运维工程师","position":"运维工程师","education":[{"degree":"本科","school":"南京大学"}],"experience":[{"company":"滴滴","position":"运维工程师"}],"skills":["Linux","Docker","Kubernetes","Jenkins"]}',
'["运维","Linux","Docker"]', datetime('now', '-12 hours')),

(2, 5, '吴敏', '移动端开发_吴敏.pdf', 253952, 'pdf', '/uploads/resumes/test9.pdf', 'analyzed', '面试', datetime('now', '-1 day'),
'{"name":"吴敏","email":"wumin@example.com","phone":"13800138009","jobTitle":"移动端开发工程师","position":"移动端开发工程师","education":[{"degree":"本科","school":"武汉大学"}],"experience":[{"company":"小米","position":"移动端开发工程师"}],"skills":["iOS","Android","Flutter","React Native"]}',
'["移动开发","iOS","Android"]', datetime('now', '-1 day')),

(2, 5, '郑涛', '架构师_郑涛.pdf', 270336, 'pdf', '/uploads/resumes/test10.pdf', 'analyzed', 'Offer', datetime('now', '-2 days'),
'{"name":"郑涛","email":"zhengtao@example.com","phone":"13800138010","jobTitle":"系统架构师","position":"系统架构师","education":[{"degree":"硕士","school":"中国科学技术大学"}],"experience":[{"company":"阿里巴巴","position":"架构师"}],"skills":["微服务","分布式系统","Kubernetes","Go"]}',
'["架构师","微服务","分布式"]', datetime('now', '-2 days'));
