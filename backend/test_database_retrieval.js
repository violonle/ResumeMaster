const { Resume } = require('./models');

async function testDatabaseRetrieval() {
  try {
    await require('./config/db').sync();

    const resume = await Resume.findOne({
      where: {
        id: 88
      }
    });

    if (resume) {
      console.log('=== 数据库原始数据 ===');
      console.log('简历ID:', resume.id);
      console.log('文件名:', resume.file_name);
      console.log('\n=== raw_text 字段 ===');
      console.log('类型:', typeof resume.raw_text);
      console.log('长度:', resume.raw_text ? resume.raw_text.length : 0);
      console.log('是否包含换行符:', resume.raw_text ? resume.raw_text.includes('\n') : false);
      console.log('是否包含"教育背景":', resume.raw_text ? resume.raw_text.includes('教育背景') : false);
      console.log('是否包含"工作经历":', resume.raw_text ? resume.raw_text.includes('工作经历') : false);
      console.log('\nraw_text前200字符:');
      console.log(resume.raw_text ? resume.raw_text.substring(0, 200) : 'N/A');
      console.log('\nraw_text完整内容:');
      console.log(resume.raw_text || 'N/A');

      console.log('\n\n=== parsed_data 字段 ===');
      console.log('类型:', typeof resume.parsed_data);
      console.log('parsed_data.rawText是否存在:', resume.parsed_data && resume.parsed_data.rawText ? '是' : '否');
      if (resume.parsed_data && resume.parsed_data.rawText) {
        console.log('parsed_data.rawText长度:', resume.parsed_data.rawText.length);
        console.log('parsed_data.rawText是否包含换行符:', resume.parsed_data.rawText.includes('\n'));
        console.log('parsed_data.rawText是否包含"教育背景":', resume.parsed_data.rawText.includes('教育背景'));
        console.log('parsed_data.rawText是否包含"工作经历":', resume.parsed_data.rawText.includes('工作经历'));
        console.log('\nparsed_data.rawText前200字符:');
        console.log(resume.parsed_data.rawText.substring(0, 200));
        console.log('\nparsed_data.rawText完整内容:');
        console.log(resume.parsed_data.rawText);
      }

      console.log('\n\n=== JSON序列化测试 ===');
      const jsonStr = JSON.stringify(resume.toJSON());
      console.log('JSON字符串长度:', jsonStr.length);
      const parsedJson = JSON.parse(jsonStr);
      console.log('解析后的raw_text是否包含换行符:', parsedJson.raw_text ? parsedJson.raw_text.includes('\n') : false);
      console.log('解析后的raw_text是否包含"教育背景":', parsedJson.raw_text ? parsedJson.raw_text.includes('教育背景') : false);
      console.log('解析后的parsed_data.rawText是否包含换行符:', parsedJson.parsed_data && parsedJson.parsed_data.rawText ? parsedJson.parsed_data.rawText.includes('\n') : false);
    } else {
      console.log('未找到ID为88的简历');
    }
  } catch (err) {
    console.error('错误:', err);
  } finally {
    process.exit(0);
  }
}

testDatabaseRetrieval();
