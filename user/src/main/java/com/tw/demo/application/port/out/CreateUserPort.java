package com.tw.demo.application.port.out;

import com.tw.demo.application.port.in.CreateUserCommand;
import com.tw.demo.domain.entities.User;

public interface CreateUserPort {
    User create(CreateUserCommand createUserCommand);
}
