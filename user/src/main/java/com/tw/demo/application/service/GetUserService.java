package com.tw.demo.application.service;

import com.tw.demo.application.port.in.GetUserQuery;
import com.tw.demo.application.port.in.QueryUserUseCase;
import com.tw.demo.application.port.out.GetUserPort;
import com.tw.demo.domain.entities.User;
import org.springframework.stereotype.Service;

@Service
public class GetUserService implements QueryUserUseCase {

    private final GetUserPort getUserPort;

    public GetUserService(GetUserPort getUserPort) {
        this.getUserPort = getUserPort;
    }

    @Override
    public User getUser(GetUserQuery getUserQuery) {
        return getUserPort.get(getUserQuery);
    }
}
