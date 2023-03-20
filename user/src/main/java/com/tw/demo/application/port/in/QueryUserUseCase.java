package com.tw.demo.application.port.in;

import com.tw.demo.domain.entities.User;

public interface QueryUserUseCase {
    User getUser(GetUserQuery getUserQuery);
}
