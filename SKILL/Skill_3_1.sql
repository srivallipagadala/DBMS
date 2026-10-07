CREATE DATABASE bookflow_db;
USE bookflow_db;


-- =========================================
-- JOIN OPERATIONS
-- =========================================

CREATE TABLE class (
    id INT,
    name VARCHAR(30)
);

CREATE TABLE class_info (
    id INT,
    address VARCHAR(30)
);

INSERT INTO class VALUES
(1, 'abhi'),
(2, 'adam'),
(4, 'alex');

INSERT INTO class_info VALUES
(1, 'DELHI'),
(2, 'MUMBAI'),
(3, 'CHENNAI');


-- CROSS JOIN
SELECT *
FROM class
CROSS JOIN class_info;


-- Recreate class table with additional data
DROP TABLE class;

CREATE TABLE class (
    id INT,
    name VARCHAR(30)
);

INSERT INTO class VALUES
(1, 'abhi'),
(2, 'adam'),
(3, 'alex'),
(4, 'anu');


-- INNER JOIN
SELECT *
FROM class
INNER JOIN class_info
ON class.id = class_info.id;


-- INNER JOIN with selected columns
SELECT class.name, class_info.address
FROM class
INNER JOIN class_info
ON class.id = class_info.id;


-- NATURAL JOIN
SELECT *
FROM class
NATURAL JOIN class_info;


-- Add more unmatched records
INSERT INTO class VALUES
(5, 'ashish');

INSERT INTO class_info VALUES
(7, 'NOIDA'),
(8, 'PANIPAT');


-- LEFT OUTER JOIN
SELECT *
FROM class
LEFT OUTER JOIN class_info
ON class.id = class_info.id;


-- LEFT JOIN - unmatched records from class
SELECT *
FROM class
LEFT JOIN class_info
ON class.id = class_info.id
WHERE class_info.id IS NULL;


-- RIGHT OUTER JOIN
SELECT *
FROM class
RIGHT OUTER JOIN class_info
ON class.id = class_info.id;


-- RIGHT JOIN - unmatched records from class_info
SELECT *
FROM class
RIGHT JOIN class_info
ON class.id = class_info.id
WHERE class.id IS NULL;


-- FULL OUTER JOIN using UNION
SELECT *
FROM class
LEFT JOIN class_info
ON class.id = class_info.id

UNION

SELECT *
FROM class
RIGHT JOIN class_info
ON class.id = class_info.id;


-- FULL OUTER JOIN - unmatched records only
SELECT *
FROM class
LEFT JOIN class_info
ON class.id = class_info.id
WHERE class_info.id IS NULL

UNION

SELECT *
FROM class
RIGHT JOIN class_info
ON class.id = class_info.id
WHERE class.id IS NULL;


-- =========================================
-- SET OPERATORS
-- =========================================

CREATE TABLE first_table (
    id INT,
    name VARCHAR(30)
);

CREATE TABLE second_table (
    id INT,
    name VARCHAR(30)
);

INSERT INTO first_table VALUES
(1, 'abhi'),
(2, 'adam');

INSERT INTO second_table VALUES
(2, 'adam'),
(3, 'chester');


-- UNION
SELECT *
FROM first_table

UNION

SELECT *
FROM second_table;


-- UNION with selected column
SELECT name
FROM first_table

UNION

SELECT name
FROM second_table;


-- UNION ALL
SELECT *
FROM first_table

UNION ALL

SELECT *
FROM second_table;


-- COUNT rows using UNION ALL
SELECT COUNT(*)
FROM (
    SELECT *
    FROM first_table

    UNION ALL

    SELECT *
    FROM second_table
) AS A;


-- INTERSECT
SELECT *
FROM first_table

INTERSECT

SELECT *
FROM second_table;


-- EXCEPT (equivalent of MINUS)
SELECT *
FROM first_table

EXCEPT

SELECT *
FROM second_table;