package taskmanager.taskmanager.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import taskmanager.taskmanager.model.ChatMessage;

import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    @Query("SELECT m FROM ChatMessage m WHERE " +
            "(m.sender = :a AND m.receiver = :b) OR (m.sender = :b AND m.receiver = :a) " +
            "ORDER BY m.sentAt ASC")
    List<ChatMessage> findConversation(@Param("a") String a, @Param("b") String b);
}
