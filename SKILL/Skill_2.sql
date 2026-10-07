create database if not exists a2520090005

use a2520090005;

CREATE TABLE student_marks (
    roll_no INT PRIMARY KEY,
    name VARCHAR(50),
    subject VARCHAR(50),
    marks DECIMAL(5,2)
);

INSERT INTO student_marks (roll_no, name, subject, marks) VALUES
(1, 'Ravi', 'Math', 85.50),
(2, 'Sita', 'Math', 92.75),
(3, 'Anil', 'Math', 78.40),
(4, 'Priya', 'Math', 88.90),
(5, 'Vijay', 'Math', 80.25),
(6, 'subbusir', 'aws', 98.50),
(7, 'dwaraka', 'dbms', 95.75),
(8, 'ranjani', 'english', 97.40),
(9, 'kavithamam', 'aws1', 99.90),
(10, 'seetha', 'azure', 82.25);

SELECT * FROM student_marks;

SELECT COUNT(*) AS total_students FROM student_marks;
SELECT SUM(marks) FROM student_marks;
SELECT AVG(marks) FROM student_marks;
SELECT MAX(marks) FROM student_marks;
SELECT MIN(marks) FROM student_marks;

SELECT * FROM student_marks WHERE marks > 85;
SELECT * FROM student_marks WHERE marks >= 90;
SELECT * FROM student_marks WHERE marks < 80;
SELECT * FROM student_marks WHERE marks BETWEEN 80 AND 90;
SELECT * FROM student_marks WHERE name LIKE 'P%';
SELECT * FROM student_marks WHERE name IN ('Ravi', 'Sita', 'Vijay');
SELECT * FROM student_marks WHERE marks > 85 AND (subject = 'Math' OR name LIKE 'P%');

UPDATE student_marks SET marks = 90.00 WHERE roll_no = 3;
UPDATE student_marks SET subject = 'Remedial Math' where marks < 80;

DELETE FROM student_marks WHERE roll_no = 5;

SELECT * FROM student_marks ORDER BY marks DESC;

SELECT subject, AVG(marks) AS avg_marks FROM student_marks GROUP BY subject;

SELECT subject, AVG(marks) AS avg_marks
FROM student_marks
GROUP BY subject
HAVING AVG(marks) > 90;

SELECT subject, COUNT(*) AS num_students
FROM student_marks
GROUP BY subject
HAVING COUNT(*) > 1;
