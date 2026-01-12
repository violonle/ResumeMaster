package interview.guide.infrastructure.docparser.core;

import interview.guide.infrastructure.docparser.exception.DocParserException;
import interview.guide.infrastructure.docparser.utils.DocTextCleaner;
import org.apache.tika.Tika;
import org.apache.tika.exception.TikaException;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;

/**
 * 通用文档解析核心组件 (基于 Apache Tika)
 */
public class TikaDocParser {

    private final Tika tika;
    private final DocTextCleaner textCleaner;

    public TikaDocParser(DocTextCleaner textCleaner) {
        this.textCleaner = textCleaner;
        this.tika = new Tika();
        this.tika.setMaxStringLength(10 * 1024 * 1024);
    }

    /**
     * 直接解析本地文件
     */
    public String parseFile(File file) {
        try (InputStream is = Files.newInputStream(file.toPath())) {
            return parseInternal(is, file.getName());
        } catch (IOException e) {
            throw new DocParserException("文件读取失败: " + e.getMessage(), e);
        }
    }

    private String parseInternal(InputStream is, String fileName) {
        try {
            String content = tika.parseToString(is);
            return textCleaner.cleanText(content);
        } catch (IOException | TikaException e) {
            throw new DocParserException("文档内容提取失败: " + e.getMessage(), e);
        }
    }
}
