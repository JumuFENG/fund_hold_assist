
import importlib.util


class classproperty:
    def __init__(self, initializer):
        self._func = initializer

    def __get__(self, instance, owner):
        if not hasattr(owner, '_classproperty_cache'):
            setattr(owner, '_classproperty_cache', {})

        cache = owner._classproperty_cache
        if self._func.__name__ not in cache:
            cache[self._func.__name__] = self._func(owner)
        return cache[self._func.__name__]


class lazy_property:
    def __init__(self, initializer):
        self._func = initializer

    def __get__(self, instance, owner):
        if instance is None:
            return self
        if not hasattr(instance, '_lazy_property_cache'):
            setattr(instance, '_lazy_property_cache', {})

        cache = instance._lazy_property_cache
        if self._func.__name__ not in cache:
            cache[self._func.__name__] = self._func(instance)
        return cache[self._func.__name__]


def convert_dict_data(data, columns, fmt='dict'):
    if fmt == 'dict':
        return data

    if fmt in ('dataframe', 'pd', 'df') and importlib.util.find_spec("pandas"):
        import pandas as df
        return df.DataFrame(data)
    else:
        fmt = 'list'

    if fmt in ('list', 'array'):
        return [[data[i][column] for column in columns] for i in range(len(data))]
    if fmt in ('tuple', 'tuplelist'):
        return [(data[i][column] for column in columns) for i in range(len(data))]

