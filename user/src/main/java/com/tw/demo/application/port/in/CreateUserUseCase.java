package com.tw.demo.application.port.in;

import com.tw.demo.domain.entities.User;

public interface CreateUserUseCase {
    User createUser(CreateUserCommand createUserCommand);
}
