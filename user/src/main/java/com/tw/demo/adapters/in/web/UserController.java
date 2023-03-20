package com.tw.demo.adapters.in.web;

import com.tw.demo.application.port.in.CreateUserCommand;
import com.tw.demo.application.port.in.CreateUserUseCase;
import com.tw.demo.application.port.in.GetUserQuery;
import com.tw.demo.application.port.in.QueryUserUseCase;
import com.tw.demo.domain.entities.User;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

    private final CreateUserUseCase createUserUseCase;
    private final QueryUserUseCase queryUserUseCase;

    public UserController(CreateUserUseCase createUserUseCase, QueryUserUseCase queryUserUseCase) {
        this.createUserUseCase = createUserUseCase;
        this.queryUserUseCase = queryUserUseCase;
    }

    @PostMapping("")
    public ResponseEntity<User> createUser(@RequestBody CreateUserCommand createUserCommand) {
        User user =  createUserUseCase.createUser(createUserCommand);
        return ResponseEntity.ok(user);
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        GetUserQuery getUserQuery = new GetUserQuery(id);
        User user = queryUserUseCase.getUser(getUserQuery);
        return ResponseEntity.ok(user);
    }
}