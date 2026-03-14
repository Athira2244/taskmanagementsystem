package taskmanager.taskmanager.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.CrossOrigin;

import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/proxy")
public class EmployeeProxyController {

    @GetMapping("/employees")
    public ResponseEntity<String> getEmployees(@RequestParam(name = "user_id", required = true) String userId) {
        // External API URL
        String urlString = "https://v1.mypayrollmaster.online/api/v2qa/employees_list?user_id=" + userId;
        System.out.println("DEBUG: Fetching employees from: " + urlString);

        try {
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) new java.net.URL(urlString)
                    .openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            int status = connection.getResponseCode();
            if (status > 299) {
                try (InputStream err = connection.getErrorStream()) {
                    String errorResponse = err != null ? new String(err.readAllBytes(), StandardCharsets.UTF_8)
                            : "No error body";
                    System.err.println("ERROR: Proxy failed with status " + status + ". Body: " + errorResponse);
                    return ResponseEntity.status(status).body(errorResponse);
                }
            }

            try (InputStream in = connection.getInputStream()) {
                String result = new String(in.readAllBytes(), StandardCharsets.UTF_8);
                return ResponseEntity.ok(result);
            }
        } catch (Exception e) {
            System.err.println("ERROR: Connection failed: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Proxy connection error: " + e.getMessage());
        }
    }

}
