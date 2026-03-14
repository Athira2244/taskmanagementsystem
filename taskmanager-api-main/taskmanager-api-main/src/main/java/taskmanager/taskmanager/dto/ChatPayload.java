package taskmanager.taskmanager.dto;

public class ChatPayload {
    private Long id;
    private String tempId;
    private String sender;
    private String receiver;
    private String content;
    private String status;

    public ChatPayload() {}

    public ChatPayload(Long id, String tempId, String sender, String receiver, String content, String status) {
        this.id = id;
        this.tempId = tempId;
        this.sender = sender;
        this.receiver = receiver;
        this.content = content;
        this.status = status;
    }

    // getters & setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTempId() { return tempId; }
    public void setTempId(String tempId) { this.tempId = tempId; }
    public String getSender() { return sender; }
    public void setSender(String sender) { this.sender = sender; }
    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
