package com.tw.demo.application.service;

import com.tw.demo.application.port.in.CreateUserCommand;
import com.tw.demo.application.port.in.CreateUserUseCase;
import com.tw.demo.application.port.out.CreateUserPort;
import com.tw.demo.domain.entities.User;
import org.springframework.stereotype.Service;

@Service
public class CreateUserService implements CreateUserUseCase {

    private final CreateUserPort createUserPort;

    public CreateUserService(CreateUserPort createUserPort) {
        this.createUserPort = createUserPort;
    }

    @Override
    public User createUser(CreateUserCommand createUserCommand) {
        return createUserPort.create(createUserCommand);
    }
}
