-- Instruction documents (Markdown) that steer AI learning-direction drafts.
-- course_id NULL means the document can be used for any course.
CREATE TABLE guidance_prompts (
 id TEXT PRIMARY KEY,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 20000),
 course_id TEXT REFERENCES courses(id),
 is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0,1)),
 created_by TEXT REFERENCES app_users(id),
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 deleted_at TEXT
);
INSERT INTO guidance_prompts(id,title,content,is_default) VALUES('00000000-0000-4000-8000-00000000a001','기본 학습 방향 지시문','# 기본 학습 방향 지시문

학생의 **확정된 시험 기록**(주차, 점수, 문항 유형, 개념 태그, 개념별 득점)만 근거로 학습 방향을 작성한다.

## 작성 형식
아래 다섯 개의 제목을 순서대로 쓴다.

1. **현재 학습 상태**: 평균과 최근 추세를 숫자로 요약한다.
2. **잘한 점**: 득점률이 높은 개념을 2~3개 짚는다.
3. **보완할 개념**: 득점률이 낮은 개념과 그 이유(문항 유형 등)를 쓴다.
4. **예측**: 지금 추세가 이어질 때 다음 평가의 예상 점수 범위(100점 환산)와, 틀릴 가능성이 높은 개념을 쓴다. 근거가 부족하면 예측의 신뢰도가 낮다고 밝힌다.
5. **다음 2주 학습 계획**: 개념별 복습 활동과 확인 가능한 목표(예: 다음 미니퀴즈 80점 이상)를 쓴다.

## 지켜야 할 점
- 성격·노력·능력을 추측하지 않는다.
- 없는 결과, 링크, 과제, 강사 의견을 지어내지 않는다.
- 학생 이름을 쓰지 않는다.
- 친절하고 구체적인 한국어로, 2000자 이내로 쓴다.
',1);
