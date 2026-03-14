package taskmanager.taskmanager.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Arrays;

@RestController
@RequestMapping("/api/localAuth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestParam(required = false) String user_id,
            @RequestParam(required = false) String password) {

        Map<String, Object> response = new HashMap<>();
        if (user_id != null && !user_id.isEmpty()) {
            response.put("success", 1);
            Map<String, Object> data = new HashMap<>();
            data.put("user_id", user_id);
            data.put("employee_name", user_id + " (Local)");

            // Stable emp_pkey
            if ("alice".equals(user_id)) {
                data.put("emp_pkey", "2");
            } else if ("bob".equals(user_id)) {
                data.put("emp_pkey", "3");
            } else {
                data.put("emp_pkey", "1");
            }

            data.put("department", "Engineering local");
            data.put("designation", "Developer local");
            response.put("data", data);
        } else {
            response.put("success", 0);
            response.put("message", "Invalid login");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/employees_list")
    public ResponseEntity<Map<String, Object>> getEmployees(@RequestParam(required = false) String user_id) {
        Map<String, Object> response = new HashMap<>();
        response.put("success", 1);

        List<Map<String, Object>> employees = Arrays.asList(
                createEmployee("1", "admin", "Admin (Local)"),
                createEmployee("2", "alice", "Alice (Local)"),
                createEmployee("3", "bob", "Bob (Local)"));
        response.put("data", employees);
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> createEmployee(String empPkey, String userId, String empName) {
        Map<String, Object> emp = new HashMap<>();
        emp.put("emp_pkey", empPkey);
        emp.put("user_id", userId);
        emp.put("EmpName", empName);
        emp.put("employee_name", empName);
        return emp;
    }
}
