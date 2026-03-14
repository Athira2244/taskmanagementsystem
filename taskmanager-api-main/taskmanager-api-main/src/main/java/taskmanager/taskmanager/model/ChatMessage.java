package taskmanager.taskmanager.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "chat_messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sender_emp_key", nullable = false)
    private String sender;

    @Column(name = "receiver_emp_key", nullable = false)
    private String receiver;

    @Column(nullable = false)
    private String content;

    @Column(name = "sent_at")
    private LocalDateTime sentAt = LocalDateTime.now();

    @Column(name = "status")
    private String status = "SENT"; // default

    // ---------- getters & setters ----------

    public Long getId() {
        return id;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getReceiver() {
        return receiver;
    }

    public void setReceiver(String receiver) {
        this.receiver = receiver;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public LocalDateTime getSentAt() {
        return sentAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}
