import os
import numpy as np
from tensorflow.keras.models import Sequential, load_model
from tensorflow.keras.layers import Dense, Dropout
from sklearn.utils import class_weight

class ModelAnn1j2:
    def __init__(self):
        self.model = None
        self.verbose = 0
        self.name = os.path.join(os.path.dirname(__file__), 'ann_1j2.keras')

    def retrain(self, x, y):
        self.model = Sequential()
        self.model.add(Dense(64, activation='relu'))
        self.model.add(Dropout(0.2))
        self.model.add(Dense(32, activation='relu'))
        self.model.add(Dropout(0.15))
        self.model.add(Dense(16, activation='relu'))
        self.model.add(Dropout(0.1))
        self.model.add(Dense(1, activation='sigmoid'))

        # self.model.compile(optimizer='sgd', loss='mean_squared_error')
        self.model.compile(optimizer='adam', loss='binary_crossentropy')

        self.train_and_save(x, y)

    def train(self, x, y):
        if not os.path.isfile(self.name):
            self.retrain(x, y)
            return

        self.model = load_model(self.name)
        self.model.summary()
        self.train_and_save(x, y)

    def train_and_save(self, x, y):
        vallen = int(len(x) * 0.8)
        x_train, y_train = np.array(x[0: vallen]), np.array(y[0: vallen])
        x_test, y_test = np.array(x[vallen:]), np.array(y[vallen:])
        class_weights = class_weight.compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
        class_weights = dict(enumerate(class_weights))
        self.model.fit(x_train, y_train, epochs=500, verbose=self.verbose, validation_data=(x_test, y_test), class_weight=class_weights)
        self.model.save(self.name)

    def predict(self, x):
        if self.model is None:
            if os.path.isfile(self.name):
                self.model = load_model(self.name)
            else:
                print('model not setup!')
                return
        return self.model.predict(np.array(x))


class ModelAnnEndVolume(ModelAnn1j2):
    def __init__(self):
        super().__init__()
        self.name = os.path.join(os.path.dirname(__file__), 'ann_evol.keras')
