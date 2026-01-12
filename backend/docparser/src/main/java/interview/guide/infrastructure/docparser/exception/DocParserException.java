package interview.guide.infrastructure.docparser.exception;

import lombok.Getter;

/**
 * 文档解析模块专用异常
 */
@Getter
public class DocParserException extends RuntimeException {
    private final int code;
    private final String message;

    public DocParserException(String message) {
        super(message);
        this.code = 500;
        this.message = message;
    }

    public DocParserException(String message, Throwable cause) {
        super(message, cause);
        this.code = 500;
        this.message = message;
    }

    public DocParserException(int code, String message) {
        super(message);
        this.code = code;
        this.message = message;
    }
}
