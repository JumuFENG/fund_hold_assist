# Python 3
# -*- coding:utf-8 -*-

import pymysql
from functools import reduce
from operator import and_, itemgetter
from peewee import ModelBase, SQL, CharField, DecimalField, FloatField
from playhouse.pool import PooledMySQLDatabase
from contextlib import contextmanager
from phon.config.config import Config


# 上下文管理器
@contextmanager
def read_context(tbl):
    db = tbl if isinstance(tbl, PooledMySQLDatabase) else tbl._meta.database
    try:
        db.connect()
        yield db
    finally:
        if not db.is_closed():
            db.close()

@contextmanager
def write_context(tbl):
    db = tbl if isinstance(tbl, PooledMySQLDatabase) else tbl._meta.database

    try:
        db.connect()  # 连接数据库
        with db.atomic():  # 开启事务
            yield db  # 返回 db 对象
    finally:
        if not db.is_closed():  # 确保关闭连接
            db.close()


def get_database(db_name, **kwargs):
    return DBManage.get_database(db_name, **kwargs)

def check_table_columns(table):
    """检查表的列是否存在，如果不存在则添加

    Useage: 
    
    with write_context(table):
        check_table_columns(table)

    """
    return DBManage.check_table_columns(table)


class DBManage:
    @classmethod
    def _setup(cls, **kwargs):
        """初始化数据库连接"""
        [kwargs.setdefault(k, v) for k,v in Config.db_config().items()]
        kwargs.setdefault('charset', 'utf8mb4')

        cls.conn = pymysql.connect(**kwargs)
        cls.cur = cls.conn.cursor()

    @classmethod
    def _close(cls):
        """关闭数据库连接"""
        cls.cur.close()
        cls.conn.close()

    @classmethod
    def check_database(cls, database, **kwargs):
        """检查数据库是否存在，如果不存在则创建, 不需要每次都运行，需要创建数据库时调用.
        """
        [kwargs.setdefault(k, v) for k,v in Config.db_config().items()]
        kwargs.setdefault('charset', 'utf8mb4')

        cls._setup(**kwargs)

        cls.cur.execute(f"SHOW DATABASES LIKE '{database}'")
        result = cls.cur.fetchone()
        if not result:
            cls.cur.execute(f"CREATE DATABASE {database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            cls.conn.commit()
            print(f"数据库 {database} 创建成功！")
        else:
            print(f"数据库 {database} 已存在。")

        cls._close()

    databases = {}
    @classmethod
    def init_database(cls, db_name, **kwargs):
        [kwargs.setdefault(k, v) for k,v in Config.db_config().items()]
        kwargs.setdefault('max_connections', 10)
        kwargs.setdefault('stale_timeout', 300)
        return PooledMySQLDatabase(db_name, **kwargs)

    @classmethod
    def get_database(cls, db_name, **kwargs):
        host = kwargs.get('host', 'localhost')
        if f'{host}_{db_name}' not in cls.databases:
            cls.databases[f'{host}_{db_name}'] = cls.init_database(db_name, **kwargs)
        return cls.databases[f'{host}_{db_name}']

    @classmethod
    def check_table(cls, table):
        """
        检查表是否存在，如果不存在则创建

        Useage: 
        
        with write_context(table):
            check_table(table)
            
        """
        if not isinstance(table, ModelBase):
            raise ValueError("参数 table 必须是 Peewee 的 Model 类")
        table._meta.database.create_tables([table], safe=True)

    @classmethod
    def check_table_columns(cls, table):
        """检查表的列是否存在，如果不存在则添加

        Useage: 
        
        with write_context(table):
            check_table_columns(table)

        """
        if not isinstance(table, ModelBase):
            raise ValueError("参数 table 必须是 Peewee 的 Model 类")

        tablename = table._meta.table_name
        dbname = table._meta.database.database

        conn = table._meta.database.connection()
        cur = conn.cursor()

        # 获取表中现有的列
        cur.execute(f'''
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{tablename}' AND table_schema = '{dbname}'
        ''')
        existing_columns = {row[0] for row in cur.fetchall()}

        # 遍历模型的字段，检查是否需要添加
        for field_name, field in table._meta.fields.items():
            if field_name not in existing_columns:
                column_definition = cls._get_column_type(field)
                sql = f'''
                    ALTER TABLE {dbname}.{tablename} 
                    ADD COLUMN {field_name} {column_definition}
                '''
                cur.execute(sql)
                conn.commit()
                print(f"表 {dbname}.{tablename} 添加列 {field_name} 成功！")

    @staticmethod
    def _get_column_type(field):
        """根据 Peewee 字段生成完整的列定义"""
        column_definition = []

        # 字段类型
        field_type = field.field_type
        if isinstance(field, CharField) and hasattr(field, "max_length"):
            field_type = f"{field_type}({field.max_length})"
        elif isinstance(field, DecimalField):
            if hasattr(field, "max_digits") and hasattr(field, "decimal_places"):
                field_type = f"{field_type}({field.max_digits}, {field.decimal_places})"
        elif isinstance(field, FloatField):
            if hasattr(field, "max_digits") and hasattr(field, "decimal_places"):
                field_type = f"{field_type}({field.max_digits}, {field.decimal_places})"
        column_definition.append(field_type)

        # 是否允许为空
        if field.null:
            column_definition.append("NULL")
        else:
            column_definition.append("NOT NULL")

        # 默认值
        if field.default is not None:
            if callable(field.default):
                default_value = field.default()
            else:
                default_value = field.default
            # 处理字符串默认值（需要加引号）
            if isinstance(default_value, str):
                default_value = f"'{default_value}'"
            column_definition.append(f"DEFAULT {default_value}")

        # 主键
        if field.primary_key:
            column_definition.append("PRIMARY KEY")

        # 自增
        if getattr(field, "sequence", False):  # 检查是否有自增属性
            column_definition.append("AUTO_INCREMENT")

        return " ".join(column_definition)



# 动态创建模型的函数
def create_model(basemodel, table=None, db=None):
    """
    动态创建模型类。

    :param basemodel: 基础模型类
    :param table: 表名（可选）
    :param db: 数据库（可选）
    :return: 新的模型类
    """
    if db is None:
        if not basemodel._meta.database:
            basemodel._meta.database = DBManage.get_database(basemodel._meta.db_name)
    if table is None and db is None:
        with write_context(basemodel):
            DBManage.check_table(basemodel)
        return basemodel

    if isinstance(db, str):
        db = DBManage.get_database(db)
    if table is None:
        if not basemodel._meta.database:
            basemodel._meta.database = db

    table = basemodel._meta.table_name if table is None else table
    db = basemodel._meta.database if db is None else db

    class Meta:
        table_name = table
        database = db
        db_name = db.database

    # 动态创建类
    _model = type(table.capitalize(), (basemodel,), {'Meta': Meta})
    with write_context(_model):
        DBManage.check_table(_model)
    return _model


def upsert(table, vdic, mkeys, batch_size=10000):
    '''
    多项插入或更新 mkeys 为主键或UNIQUE

    :param table: 表名（Model）
    :param vdic: 所有需要插入或更新的数据, list(dict)
    :param mkeys: 索引键/主键(必须在建表时指定主键或唯一键) list(str)
    :param batch_size: 每批次处理的记录数
    :return: 受影响的行数
    '''
    allkeys = list(vdic[0].keys())
    ukeys = [k for k in allkeys if k not in mkeys]
    query = f"""
        INSERT INTO {table._meta.name} ({", ".join(allkeys)})
        VALUES ({", ".join(["%s"] * len(allkeys))})
        ON DUPLICATE KEY UPDATE {", ".join([f"{k} = VALUES({k})" for k in ukeys])}
        """
    params_list = [list(itemgetter(*allkeys)(value)) for value in vdic]

    total_rows = 0
    with write_context(table):
        conn = table._meta.database.connection()
        cur = conn.cursor()
        try:
            for i in range(0, len(params_list), batch_size):
                batch_params = params_list[i:i + batch_size]
                cur.executemany(query, batch_params)
                total_rows += cur.rowcount
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e

    return total_rows

def insert_or_update(table, vdic, mkeys, batch_size=10000):
    '''
    多项插入或更新, mkeys(组合)需能唯一标识.

    :param table: 表名（Model）
    :param vdic: 所有需要插入或更新的数据, list(dict)
    :param mkeys: 索引键 list(str)，可以唯一标识一条记录
    :param batch_size: 每批次处理的记录数
    :return: 受影响的行数
    '''
    if not vdic:
        raise ValueError("vdic 不能为空")
    if not mkeys:
        raise ValueError("mkeys 不能为空")
    if not all(key in vdic[0] for key in mkeys):
        raise ValueError("mkeys 中的键必须在 vdic 的字典中存在")
    if table._meta.primary_key.primary_key:
        if mkeys == 1 and mkeys[0] == table._meta.primary_key.name:
            return upsert(table, vdic, mkeys, batch_size)
    elif table._meta.primary_key.name == '__composite_key__':
        if all(k in table._meta.primary_key.field_names for k in mkeys):
            return upsert(table, vdic, mkeys, batch_size)

    affected_rows = 0
    buffer = []  # 缓存数组，用于批量插入

    def flush_buffer():
        '''将缓存数组中的数据批量插入数据库'''
        nonlocal affected_rows
        if buffer:
            with write_context(table):
                table.insert_many(buffer).execute()
            affected_rows += len(buffer)
            buffer.clear()

    # 分批处理数据
    for record in vdic:
        # 构建组合查询条件
        conditions = [getattr(table, key) == record[key] for key in mkeys]
        combined_condition = reduce(and_, conditions)

        with read_context(table):
            existing_record = table.select().where(combined_condition).first()
        if existing_record:
            # 如果记录存在，则更新
            update_data = {k: v for k, v in record.items() if k not in mkeys}
            if update_data:
                with write_context(table):
                    table.update(**update_data).where(combined_condition).execute()
                affected_rows += 1
        else:
            buffer.append(record)
            if len(buffer) >= batch_size:
                flush_buffer()

    flush_buffer()

    return affected_rows


def copy_table(from_table, to_table, batch_size=100):
    from_db = from_table._meta.database
    to_db = to_table._meta.database

    try:
        with read_context(from_db):
            total_count = from_table.select().count()

        with write_context(to_db):
            to_db.create_tables([to_table], safe=True)

            for i in range(0, total_count, batch_size):
                with read_context(from_db):
                    batch = list(from_table.select().offset(i).limit(batch_size))

                # 获取所有字段名
                all_fields = to_table._meta.fields
                # 获取主键字段名
                primary_keys = to_table._meta.primary_key.field_names if hasattr(to_table._meta.primary_key, 'field_names') else [to_table._meta.primary_key.name]
                # 过滤掉主键字段，只保留非主键字段
                non_primary_fields = {name: field for name, field in all_fields.items() if name not in primary_keys}

                # 批量插入或更新
                data_to_insert = []
                for slave in batch:
                    row_data = {name: getattr(slave, name) for name in all_fields}
                    data_to_insert.append(row_data)

                # 动态构建更新字典
                update_dict = {field: SQL(f'excluded.{name}') for name, field in non_primary_fields.items()}

                to_table.insert_many(data_to_insert).on_conflict(
                    conflict_target=primary_keys,  # 主键字段
                    update=update_dict  # 更新非主键字段
                ).execute()

        print("Verifying data...")
        with read_context(from_db):
            from_count = from_table.select().count()
        with read_context(to_db):
            to_count = to_table.select().count()

        if from_count == to_count:
            print(f"Data copy successful. {to_count} records copied.")
        else:
            print(f"Warning: Record count mismatch. Source: {from_count}, Destination: {to_count}")

    except Exception as e:
        print(f"An error occurred during the copy process: {str(e)}")
        raise


def copy_table_to(from_table, to_db, batch_size=100):
    # 从一个数据库中复制一个表到另外一个数据库中
    if not from_table._meta.database:
        from_table = create_model(from_table)
    to_table = create_model(from_table, None, to_db)
    copy_table(from_table, to_table, batch_size)

