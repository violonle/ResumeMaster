package interview.guide.infrastructure.docparser;

import interview.guide.infrastructure.docparser.core.TikaDocParser;
import interview.guide.infrastructure.docparser.utils.DocTextCleaner;
import java.io.File;

/**
 * 命令行入口程序
 */
public class DocParserApp {
    public static void main(String[] args) {
        if (args.length < 1) {
            System.err.println("用法: java -jar docparser.jar <文件路径>");
            System.exit(1);
        }

        String filePath = args[0];
        File file = new File(filePath);

        if (!file.exists()) {
            System.err.println("错误: 文件不存在 -> " + filePath);
            System.exit(1);
        }

        try {
            DocTextCleaner cleaner = new DocTextCleaner();
            TikaDocParser parser = new TikaDocParser(cleaner);
            
            // 直接解析文件
            String content = parser.parseFile(file);
            
            // 将结果输出到标准输出，Node.js 会捕获它
            System.out.println(content);
        } catch (Exception e) {
            System.err.println("解析失败: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
