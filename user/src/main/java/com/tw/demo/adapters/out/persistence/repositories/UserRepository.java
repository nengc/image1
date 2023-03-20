package com.tw.demo.adapters.out.persistence.repositories;

import com.tw.demo.adapters.out.persistence.entities.UserEntity;
import com.tw.demo.adapters.out.persistence.repositories.BaseRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends BaseRepository<UserEntity, Long> {
}
