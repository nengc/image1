package com.tw.demo.adapters.out.persistence;

import com.tw.demo.adapters.out.persistence.entities.UserEntity;
import com.tw.demo.adapters.out.persistence.repositories.UserRepository;
import com.tw.demo.application.port.in.CreateUserCommand;
import com.tw.demo.application.port.in.GetUserQuery;
import com.tw.demo.application.port.out.CreateUserPort;
import com.tw.demo.application.port.out.GetUserPort;
import com.tw.demo.domain.entities.User;
import org.springframework.stereotype.Component;

@Component
public class UserPersistenceAdapter implements CreateUserPort, GetUserPort {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    public UserPersistenceAdapter(UserRepository userRepository, UserMapper userMapper) {
        this.userRepository = userRepository;
        this.userMapper = userMapper;
    }

    @Override
    public User create(CreateUserCommand createUserCommand) {
        UserEntity userEntity = userMapper.map(createUserCommand);
        return  userMapper.map(userRepository.save(userEntity));
    }

    @Override
    public User get(GetUserQuery getUserQuery) {
        UserEntity userEntity = userRepository.findById(getUserQuery.getId()).get();
        return userMapper.map(userEntity);
    }
}
