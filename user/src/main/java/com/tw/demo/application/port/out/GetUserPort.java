package com.tw.demo.application.port.out;

import com.tw.demo.application.port.in.GetUserQuery;
import com.tw.demo.domain.entities.User;

public interface GetUserPort {
    User get(GetUserQuery getUserQuery);
}
