package interview.guide.infrastructure.docparser.utils;

/**
 * 文档解析模块专用的文本清理工具
 */
public class DocTextCleaner {

    /**
     * 清理和规范化文本内容
     */
    public String cleanText(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }

        return text
            .replaceAll("\\r\\n", "\n")
            .replaceAll("\\r", "\n")
            .replaceAll("\\n{3,}", "\n\n")
            .lines()
            .map(String::strip)
            .reduce((a, b) -> a + "\n" + b)
            .orElse("")
            .strip();
    }
}
