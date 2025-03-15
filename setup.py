from setuptools import setup, find_packages

phon_name = 'phon'
phon_ver = '0.0.1'

setup(
    name=phon_name,
    version=phon_ver,
    packages=find_packages(include=["phon", "phon.*"]),  # 只包含 phon 及其子包
    include_package_data=True,  # 包含包中的数据文件
    install_requires=[],  # 依赖的其他包
)
