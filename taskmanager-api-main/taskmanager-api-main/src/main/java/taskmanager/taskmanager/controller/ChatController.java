package taskmanager.taskmanager.controller;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.server.ResponseStatusException;
import taskmanager.taskmanager.model.ChatMessage;
import taskmanager.taskmanager.repository.ChatMessageRepository;
import taskmanager.taskmanager.dto.ChatPayload;
import taskmanager.taskmanager.dto.ReadReceipt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import java.security.Principal;
import java.util.List;
import java.util.stream.Collectors;

@Controller
@RestController
public class ChatController {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    /**
     * STEP 1: Sender sends a message (client includes tempId)
     * Server saves message, echoes SENT to sender (including tempId),
     * and sends RECEIVED to the receiver.
     */
    @MessageMapping("/send-message")
    @Transactional
    public void sendMessage(ChatPayload payload, Principal principal) {

        if (principal == null || payload == null || payload.getReceiver() == null || payload.getContent() == null) {
            return;
        }

        // Force sender from authenticated user (principal holds emp_pkey)
        String sender = principal.getName();

        // Build entity and save with initial status SENT
        ChatMessage message = new ChatMessage();
        message.setSender(sender);
        message.setReceiver(payload.getReceiver());
        message.setContent(payload.getContent());
        message.setStatus("SENT");
        ChatMessage saved = chatMessageRepository.save(message);

        // Prepare payloads
        // 1) Send RECEIVED to receiver (they will display and ACK delivery)
        ChatPayload toReceiver = new ChatPayload(
                saved.getId(),
                payload.getTempId(), // pass tempId along if present
                saved.getSender(),
                saved.getReceiver(),
                saved.getContent(),
                "RECEIVED"
        );

        messagingTemplate.convertAndSendToUser(
                saved.getReceiver(),
                "/queue/messages",
                toReceiver
        );

        // 2) Send SENT confirmation to sender (include tempId so client can match)
        ChatPayload toSender = new ChatPayload(
                saved.getId(),
                payload.getTempId(),
                saved.getSender(),
                saved.getReceiver(),
                saved.getContent(),
                "SENT"
        );

        messagingTemplate.convertAndSendToUser(
                saved.getSender(),
                "/queue/messages",
                toSender
        );
    }

    /**
     * STEP 2: Receiver ACKs delivery
     * Client publishes to /app/message-delivered with id (server id).
     * Server updates DB to DELIVERED and notifies original sender.
     */
    @MessageMapping("/message-delivered")
    @Transactional
    public void messageDelivered(ChatPayload payload) {

        if (payload == null || payload.getId() == null) {
            return;
        }

        // Update DB status to DELIVERED
        chatMessageRepository.findById(payload.getId()).ifPresent(msg -> {
            msg.setStatus("DELIVERED");
            chatMessageRepository.save(msg);
        });

        // Notify original sender with DELIVERED (include tempId if present)
        ChatPayload delivered = new ChatPayload(
                payload.getId(),
                payload.getTempId(),
                payload.getSender(),
                payload.getReceiver(),
                payload.getContent(),
                "DELIVERED"
        );

        messagingTemplate.convertAndSendToUser(
                payload.getSender(),
                "/queue/messages",
                delivered
        );
    }

// REST: Load conversation history between authenticated user and {other}
@GetMapping("/api/chat/history/{other}")
public List<ChatPayload> getHistory(
        @PathVariable("other") String other,
        Principal principal,
        @RequestHeader(value = "emp_pkey", required = false) String empPkeyHeader) {
        // Determine "me": prefer Principal, otherwise use header
        String me = (principal != null) ? principal.getName() : empPkeyHeader;
        if (me == null) {
            // No authenticated principal and no header provided
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }
        List<ChatMessage> messages = chatMessageRepository.findConversation(me, other);
        return messages.stream()
                .map(m -> new ChatPayload(
                        m.getId(), null, // tempId not needed for history
                        m.getSender(),
                        m.getReceiver(),
                        m.getContent(),
                        m.getStatus()
                ))
                .collect(Collectors.toList()); }
    /** * MessageMapping: Receiver marks a message as READ. * Client publishes to /app/message-read with messageId + sender + receiver. */
    @MessageMapping("/message-read")
    @Transactional
    public void messageRead(ReadReceipt receipt, Principal principal) {
        if (receipt == null || receipt.getMessageId() == null) return; // Optional: verify principal is the receiver
        String me = principal.getName(); // Update DB: mark message as READ if receiver matches
        chatMessageRepository.findById(receipt.getMessageId()).ifPresent(msg -> {
            if (msg.getReceiver().equals(me)) {
                msg.setStatus("READ");
                chatMessageRepository.save(msg);

                // Notify original sender that message was read
                ChatPayload payload = new ChatPayload(
                        msg.getId(),
                        null,
                        msg.getSender(),
                        msg.getReceiver(),
                        null,
                        "READ" );
                messagingTemplate.convertAndSendToUser(msg.getSender(), "/queue/messages", payload);
            }
        });
    } }
